const PLAN_ORDER = ['basic', 'pro', 'business'];

function requirePlan(minPlan) {
  return (req, res, next) => {
    const plan = req.business?.plan || 'basic';
    if (PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(minPlan)) return next();
    res.status(403).json({
      error: 'Plan insuficiente',
      requiredPlan: minPlan,
      currentPlan: plan,
      upgradeUrl: '/dashboard/configuracion',
    });
  };
}

module.exports = { requirePlan };
