export function StatCard({ title, value, trend, icon, color = "blue" }) {
  const colors = {
    blue: "from-blue-500 to-blue-600",
    purple: "from-purple-500 to-purple-600",
    green: "from-green-500 to-green-600",
    orange: "from-orange-500 to-orange-600",
  };

  return (
    <div className="hover:-translate-y-1 transition-transform bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colors[color]} text-white flex items-center justify-center mb-4 text-xl`}>
        {icon}
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      {trend && (
        <span className="text-sm font-medium text-green-600">{trend} vs mes anterior</span>
      )}
    </div>
  );
}

export function StatsGrid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{children}</div>;
}
