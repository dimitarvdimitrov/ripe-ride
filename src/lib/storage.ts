import { supabaseAdmin } from './supabase'

/**
 * Generate a consistent file path for GPX files
 * Format: {userId}/{type}/{fileName}
 * where type is 'routes' or 'activities'
 */
export function generateGpxFilePath(
  userId: string, 
  type: 'routes' | 'activities', 
  fileName: string
): string {
  // Ensure fileName has .gpx extension
  const cleanFileName = fileName.endsWith('.gpx') ? fileName : `${fileName}.gpx`
  return `${userId}/${type}/${cleanFileName}`
}

/**
 * Upload a GPX file to Supabase Storage
 */
export async function uploadGpxFile(
  userId: string,
  type: 'routes' | 'activities',
  fileName: string,
  gpxContent: string
): Promise<{ filePath: string; publicUrl: string } | null> {
  try {
    const filePath = generateGpxFilePath(userId, type, fileName)
    
    const { data, error } = await supabaseAdmin.storage
      .from('gpx_files')
      .upload(filePath, gpxContent, {
        contentType: 'application/gpx+xml',
        cacheControl: '3600',
        upsert: true // Allow overwriting existing files
      })

    if (error) {
      console.error('Error uploading GPX file:', error)
      return null
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabaseAdmin.storage
      .from('gpx_files')
      .getPublicUrl(filePath)

    return {
      filePath: data.path,
      publicUrl: urlData.publicUrl
    }
  } catch (error) {
    console.error('Error in uploadGpxFile:', error)
    return null
  }
}

/**
 * Download a GPX file from Supabase Storage
 */
export async function downloadGpxFile(filePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from('gpx_files')
      .download(filePath)

    if (error) {
      console.error('Error downloading GPX file:', error)
      return null
    }

    // Convert Blob to text
    const gpxContent = await data.text()
    return gpxContent
  } catch (error) {
    console.error('Error in downloadGpxFile:', error)
    return null
  }
}

/**
 * Delete a GPX file from Supabase Storage
 */
export async function deleteGpxFile(filePath: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.storage
      .from('gpx_files')
      .remove([filePath])

    if (error) {
      console.error('Error deleting GPX file:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in deleteGpxFile:', error)
    return false
  }
}

/**
 * List GPX files for a user
 */
export async function listUserGpxFiles(
  userId: string, 
  type?: 'routes' | 'activities'
): Promise<Array<{ name: string; path: string; size: number; lastModified: string }>> {
  try {
    const prefix = type ? `${userId}/${type}/` : `${userId}/`
    
    const { data, error } = await supabaseAdmin.storage
      .from('gpx_files')
      .list(prefix, {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error('Error listing GPX files:', error)
      return []
    }

    return data.map(file => ({
      name: file.name,
      path: `${prefix}${file.name}`,
      size: file.metadata?.size || 0,
      lastModified: file.created_at || file.updated_at || ''
    }))
  } catch (error) {
    console.error('Error in listUserGpxFiles:', error)
    return []
  }
}

/**
 * Check if a GPX file exists
 */
export async function gpxFileExists(filePath: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from('gpx_files')
      .list(filePath.substring(0, filePath.lastIndexOf('/')), {
        search: filePath.substring(filePath.lastIndexOf('/') + 1)
      })

    return !error && data && data.length > 0
  } catch (error) {
    console.error('Error in gpxFileExists:', error)
    return false
  }
}