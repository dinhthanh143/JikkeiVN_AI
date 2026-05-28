import { useCallback } from 'react'
import { uploadImage, getImageUrl } from '@/services/cloudinary'

export function useCloudinary() {
  const handleUpload = useCallback(async (file: File) => {
    try {
      const result = await uploadImage(file)
      return result
    } catch (error) {
      console.error('Upload failed:', error)
      throw error
    }
  }, [])

  const getUrl = useCallback((publicId: string, options?: Record<string, unknown>) => {
    return getImageUrl(publicId, options)
  }, [])

  return {
    uploadImage: handleUpload,
    getImageUrl: getUrl,
  }
}
