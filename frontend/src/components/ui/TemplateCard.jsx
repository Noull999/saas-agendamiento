export function TemplateCard({ template, isSelected, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-xl overflow-hidden cursor-pointer
        transition-all duration-300 border-2 hover:shadow-lg
        ${
          isSelected
            ? "border-blue-600 shadow-xl shadow-blue-200 scale-105"
            : "border-gray-200 hover:border-blue-300 shadow-md"
        }
      `}
    >
      {isSelected && (
        <div className="absolute top-3 right-3 bg-blue-600 text-white rounded-full p-1 z-10">
          ✓
        </div>
      )}

      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
        {children}
      </div>

      <div className="p-4 bg-white">
        <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
        <p className="text-sm text-gray-600">{template.description}</p>
      </div>
    </button>
  );
}
