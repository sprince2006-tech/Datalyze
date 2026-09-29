/**
 * DataLyze logo.
 *
 * @param {number}  size      - Square size in pixels
 * @param {boolean} withText  - Show the "DataLyze" wordmark beside the icon
 * @param {'light'|'dark'}  theme - Text color for dark sidebars vs. light pages
 */
export default function Logo({ size = 32, withText = true, theme = 'light' }) {
  const iconRadius = Math.round(size * 0.22);

  return (
    <div className="flex items-center gap-2 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        aria-label="DataLyze"
        style={{ borderRadius: iconRadius, flexShrink: 0 }}
      >
        <rect width="64" height="64" rx="14" fill="#e03e2d" />
        <rect x="15" y="34" width="6" height="16" rx="1.5" fill="#ffffff" />
        <rect x="29" y="18" width="6" height="32" rx="1.5" fill="#ffffff" />
        <rect x="43" y="28" width="6" height="22" rx="1.5" fill="#ffffff" />
      </svg>

      {withText && (
        <span
          className={`font-bold leading-none ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          style={{ fontSize: Math.round(size * 0.56) }}
        >
          Data<span className="text-brand">lyze</span>
        </span>
      )}
    </div>
  );
}