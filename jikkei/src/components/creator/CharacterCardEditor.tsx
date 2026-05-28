interface CharacterCardEditorProps {
  onSave?: (data: Record<string, unknown>) => void
}

export default function CharacterCardEditor({ onSave }: CharacterCardEditorProps) {
  return (
    <div className="w-full bg-jikkei-black-800 border border-jikkei-accent rounded-lg p-6">
      <h3 className="text-xl font-bold text-jikkei-accent mb-4">Character Card Editor</h3>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Character Name"
          className="w-full bg-jikkei-black-700 border border-jikkei-accent text-white px-3 py-2 rounded"
        />
        <textarea
          placeholder="Character Description"
          className="w-full bg-jikkei-black-700 border border-jikkei-accent text-white px-3 py-2 rounded h-24"
        />
        <button
          onClick={() => onSave?.({})}
          className="bg-jikkei-accent text-jikkei-black-900 font-semibold px-4 py-2 rounded hover:bg-jikkei-pink-700 transition"
        >
          Save Character
        </button>
      </div>
    </div>
  )
}
