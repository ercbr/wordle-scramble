const ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['enter','z','x','c','v','b','n','m','backspace'],
];

export default function SharedKeyboard({ letterStates, onKey, disabled }) {
  const handleClick = (key) => {
    if (disabled) return;
    onKey(key);
  };

  return (
    <div className="keyboard">
      {ROWS.map((row, i) => (
        <div key={i} className="keyboard-row">
          {row.map(key => {
            const isSpecial = key === 'enter' || key === 'backspace';
            const state = letterStates[key] || '';
            return (
              <button
                key={key}
                className={`key ${state} ${isSpecial ? 'wide' : ''} ${key === 'backspace' ? 'backspace-key' : ''}`}
                onClick={() => handleClick(key)}
                disabled={disabled}
              >
                {key === 'backspace' ? '⌫' : key === 'enter' ? 'ENTER' : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
