interface AssetUploaderProps {
  onUpload?: (file: File) => void
}

export default function AssetUploader({ onUpload }: AssetUploaderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload?.(file)
    }
  }

  return (
    <div className="w-full bg-jikkei-black-800 border-2 border-dashed border-jikkei-accent rounded-lg p-8">
      <input
        type="file"
        onChange={handleChange}
        className="hidden"
        id="asset-input"
        accept="image/*,audio/*"
      />
      <label
        htmlFor="asset-input"
        className="cursor-pointer flex flex-col items-center justify-center text-center"
      >
        <p className="text-xl font-semibold text-jikkei-accent mb-2">Upload Asset</p>
        <p className="text-jikkei-pink-300 text-sm">Drag and drop or click to select</p>
      </label>
    </div>
  )
}
