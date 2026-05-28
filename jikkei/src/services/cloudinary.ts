export const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
export const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export function getImageUrl(publicId: string, options?: Record<string, unknown>): string {
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload`
  const transformations = Object.entries(options || {})
    .map(([key, value]) => `${key}_${value}`)
    .join(',')

  const path = transformations ? `${transformations}/${publicId}` : publicId
  return `${baseUrl}/${path}`
}

export function uploadImage(file: File): Promise<{ publicId: string; secureUrl: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

  return fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  })
    .then((res) => res.json())
    .then((data) => ({
      publicId: data.public_id,
      secureUrl: data.secure_url,
    }))
}
