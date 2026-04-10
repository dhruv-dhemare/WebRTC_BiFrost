export default function FeaturesBar() {
  const features = [
    {
      id: 'e2e',
      icon: '🔒',
      label: 'End-to-end',
    },
    {
      id: 'realtime',
      icon: '⚡',
      label: 'Real-time',
    },
    {
      id: 'p2p',
      icon: '🌐',
      label: 'P2P',
    },
  ]

  return (
    <div className="features-bar" role="region" aria-label="Key features">
      {features.map((feature) => (
        <div key={feature.id} className="feature">
          <span className="feature-icon" aria-hidden="true">
            {feature.icon}
          </span>
          <span>{feature.label}</span>
        </div>
      ))}
    </div>
  )
}
