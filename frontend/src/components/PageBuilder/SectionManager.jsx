export default function SectionManager({ sections, onReorder }) {
  const sectionIds = Object.keys(sections).filter(id => id !== 'section_order');
  const currentOrder = sections.section_order || sectionIds;

  const moveSection = (id, direction) => {
    const idx = currentOrder.indexOf(id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === currentOrder.length - 1)) {
      return;
    }

    const newOrder = [...currentOrder];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    onReorder(newOrder);
  };

  return (
    <div className="space-y-3 bg-gray-50 p-6 rounded-xl">
      <h3 className="font-bold text-gray-900">Orden de Secciones</h3>

      <div className="space-y-2">
        {currentOrder.map((sectionId, idx) => {
          const section = sections[sectionId];
          if (!section) return null;

          return (
            <div
              key={sectionId}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                section.enabled
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-100 border-gray-300 opacity-60'
              }`}
            >
              <span className="font-medium text-gray-700 capitalize text-sm">
                {sectionId.replace(/_/g, ' ')}
              </span>

              <div className="flex gap-1">
                <button
                  onClick={() => moveSection(sectionId, 'up')}
                  disabled={idx === 0}
                  className="px-2 py-1 text-xs font-medium rounded bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
                  title="Mover arriba"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveSection(sectionId, 'down')}
                  disabled={idx === currentOrder.length - 1}
                  className="px-2 py-1 text-xs font-medium rounded bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors"
                  title="Mover abajo"
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
