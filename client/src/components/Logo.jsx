export default function Logo({ variant = 'large' }) {
  return (
    <div className={`logo-wrapper logo-${variant}`}>
      <div className="logo-icon" aria-hidden="true">
        🌐
      </div>
      <div className="logo-text">
        Bifrost<span>Mesh</span>
      </div>
    </div>
  )
}
