export function Section({ children, className = "", gradient = false }) {
  return (
    <section
      className={`py-12 md:py-16 ${
        gradient ? "bg-gradient-to-r from-blue-50 to-purple-50" : "bg-white"
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function Container({ children, className = "" }) {
  return (
    <div className={`max-w-6xl mx-auto px-4 md:px-8 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, icon = null }) {
  return (
    <div className="mb-8">
      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
        {icon && <span className="text-blue-600">{icon}</span>}
        {children}
      </h2>
      <div className="mt-2 h-1 w-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
    </div>
  );
}
