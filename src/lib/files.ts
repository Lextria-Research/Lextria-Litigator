// src/lib/files.ts
// Multi-provider file storage abstraction: WORKDRIVE | SUPABASE_TEST | MOCK.
// Handles file upload and download for court pleadings, orders, evidence, versions.

import { clock } from './clock';
import { coreDb, isSupabaseConfigured, supabase } from './supabase';
import type { CoreDocument } from './types';

export type StorageProviderType = 'WORKDRIVE' | 'SUPABASE_TEST' | 'MOCK';

export const MAX_UPLOAD_SIZE_BYTES = 4.2 * 1024 * 1024; // 4.2 MB (Vercel payload ceiling)

export const LITIGATION_FILE_CATEGORIES = [
  'Pleadings',
  'Orders',
  'Evidence',
  'Notices',
  'Correspondence',
  'Drafts',
  'Final',
  'Internal',
] as const;

export type LitigationFileCategory = typeof LITIGATION_FILE_CATEGORIES[number];

export function sanitizeFolderName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim();
}

/**
 * Detect active storage provider based on environment
 */
export function getActiveProvider(): StorageProviderType {
  if (import.meta.env.VITE_WORKDRIVE_ROOT_FOLDER_ID && import.meta.env.VITE_ZOHO_CLIENT_ID) {
    return 'WORKDRIVE';
  }
  if (isSupabaseConfigured) {
    return 'SUPABASE_TEST';
  }
  return 'MOCK';
}

/**
 * Calculates standardized folder path:
 * {client_code} - {client_name}/{project_code}/{category}/
 */
export function resolveLitigatorFolderPath(
  category: LitigationFileCategory | string,
  clientCode?: string,
  clientName?: string,
  projectCode?: string
): string {
  const cleanClient = sanitizeFolderName(`${clientCode || 'CLI'} - ${clientName || 'Client'}`);
  const cleanProject = sanitizeFolderName(projectCode || 'GENERAL');
  const cleanCategory = sanitizeFolderName(category || 'General');
  return `${cleanClient}/${cleanProject}/${cleanCategory}`;
}

const mockFileStore = new Map<string, { blob: Blob | File; record: CoreDocument }>();

/**
 * Uploads a file through the active storage provider and logs to core.documents
 */
export async function uploadLitigatorFile(params: {
  file: File;
  category: LitigationFileCategory | string;
  clientCode?: string;
  clientName?: string;
  projectCode?: string;
  projectCodeId?: string;
  clientShared?: boolean;
  financeOnly?: boolean;
  uploadedByUserId?: string;
}): Promise<CoreDocument> {
  if (params.file.size > MAX_UPLOAD_SIZE_BYTES) {
    const mb = (params.file.size / (1024 * 1024)).toFixed(2);
    throw new Error(
      `File size (${mb} MB) exceeds maximum upload limit of 4.2 MB. Please compress or optimize the file.`
    );
  }

  const provider = getActiveProvider();
  const fileId = crypto.randomUUID();
  const folderPath = resolveLitigatorFolderPath(
    params.category,
    params.clientCode,
    params.clientName,
    params.projectCode
  );
  const fileName = sanitizeFolderName(params.file.name);
  const fullPath = `${folderPath}/${fileName}`;

  let zohoResourceId: string | null = null;
  let zohoPermalink: string | null = null;

  if (provider === 'WORKDRIVE') {
    try {
      const formData = new FormData();
      formData.append('file', params.file, fileName);

      const resp = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (resp.ok) {
        const uploadResult = await resp.json();
        zohoPermalink = uploadResult.url || null;
        zohoResourceId = uploadResult.resourceId || `res_${Date.now()}`;
      } else {
        console.warn('WorkDrive upload returned status', resp.status);
      }
    } catch (e) {
      console.warn('WorkDrive upload fallback', e);
    }
  } else if (provider === 'SUPABASE_TEST') {
    try {
      const storagePath = fullPath;
      const { data, error } = await supabase.storage
        .from('test-files')
        .upload(storagePath, params.file, { upsert: true });

      if (error) {
        console.warn('Supabase storage upload error:', error.message);
      } else if (data) {
        zohoResourceId = data.path;
      }
    } catch (e) {
      console.warn('Supabase upload exception:', e);
    }
  }

  const docRecord: CoreDocument = {
    id: fileId,
    project_code_id: params.projectCodeId || null,
    category: params.category,
    file_name: fileName,
    mime_type: params.file.type || 'application/octet-stream',
    size_bytes: params.file.size,
    zoho_resource_id: zohoResourceId || `res-${fileId}`,
    zoho_permalink: zohoPermalink || `https://workdrive.zoho.com/file/${fileId}`,
    workdrive_path: fullPath,
    client_shared: params.clientShared || false,
    finance_only: params.financeOnly || false,
    source_app: 'LITIGATOR',
    uploaded_by: params.uploadedByUserId || null,
    uploaded_at: clock.nowISO(),
  };

  if (isSupabaseConfigured) {
    try {
      await coreDb.from('documents').insert(docRecord);
    } catch (err) {
      console.warn('Could not insert core.documents row:', err);
    }
  }

  mockFileStore.set(fileId, { blob: params.file, record: docRecord });
  return docRecord;
}

/**
 * Retrieves preview or download URL for a DocumentRecord
 */
export async function getDocumentUrl(doc: CoreDocument): Promise<string> {
  const provider = getActiveProvider();

  if (mockFileStore.has(doc.id)) {
    return URL.createObjectURL(mockFileStore.get(doc.id)!.blob);
  }

  if (provider === 'SUPABASE_TEST' && doc.zoho_resource_id) {
    const { data } = await supabase.storage
      .from('test-files')
      .createSignedUrl(doc.zoho_resource_id, 900);
    if (data?.signedUrl) return data.signedUrl;
  }

  if (provider === 'WORKDRIVE') {
    return `/api/files?action=download_url&resourceId=${doc.zoho_resource_id}`;
  }

  return doc.zoho_permalink || '#';
}

/**
 * Returns a direct/proxy download or preview link for immediate JSX rendering
 */
export function getDocumentDownloadLink(
  doc?: { zoho_permalink?: string | null; zoho_resource_id?: string | null } | null
): string {
  if (!doc) return '#';
  if (doc.zoho_permalink) return doc.zoho_permalink;
  if (doc.zoho_resource_id) {
    return `/api/files?action=download_url&resourceId=${doc.zoho_resource_id}`;
  }
  return '#';
}

/**
 * Fetch documents for a given project code
 */
export async function fetchProjectDocuments(projectCodeId: string): Promise<CoreDocument[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await coreDb
      .from('documents')
      .select('*')
      .eq('project_code_id', projectCodeId)
      .order('uploaded_at', { ascending: false });

    if (!error && data) return data as CoreDocument[];
  }

  const results: CoreDocument[] = [];
  for (const item of mockFileStore.values()) {
    if (item.record.project_code_id === projectCodeId) {
      results.push(item.record);
    }
  }
  return results;
}
