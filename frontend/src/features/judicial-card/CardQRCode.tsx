import styles from './CardQRCode.module.css';

interface CardQRCodeProps {
  payload: string;
  holderName: string;
  cardNumber: string;
}

/** Deterministic faux-QR pattern from payload (mock — no third-party QR lib). */
const buildPattern = (seed: string): boolean[][] => {
  const size = 11;
  const cells: boolean[][] = [];

  for (let row = 0; row < size; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < size; col += 1) {
      const inTopLeft = row < 3 && col < 3;
      const inTopRight = row < 3 && col >= size - 3;
      const inBottomLeft = row >= size - 3 && col < 3;

      if (inTopLeft || inTopRight || inBottomLeft) {
        const localRow = inBottomLeft ? row - (size - 3) : row;
        const localCol = inTopRight ? col - (size - 3) : col;
        const isBorder =
          localRow === 0 || localRow === 2 || localCol === 0 || localCol === 2;
        const isCenter = localRow === 1 && localCol === 1;
        line.push(isBorder || isCenter);
        continue;
      }

      let hash = 0;
      const token = `${seed}:${row}:${col}`;
      for (let i = 0; i < token.length; i += 1) {
        hash = (hash * 31 + token.charCodeAt(i)) % 997;
      }
      line.push(hash % 3 !== 0);
    }
    cells.push(line);
  }

  return cells;
};

const CardQRCode = ({
  payload,
  holderName,
  cardNumber,
}: CardQRCodeProps): JSX.Element => {
  const pattern = buildPattern(payload);

  return (
    <div className={styles.back}>
      <div className={styles.qrWrap} aria-hidden>
        <div className={styles.qr}>
          {pattern.map((row, rowIndex) => (
            <div key={`r-${rowIndex}`} className={styles.qrRow}>
              {row.map((filled, colIndex) => (
                <span
                  key={`c-${rowIndex}-${colIndex}`}
                  className={filled ? styles.cellOn : styles.cellOff}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className={styles.holder}>{holderName}</p>
      <p className={styles.number}>{cardNumber}</p>
    </div>
  );
};

export default CardQRCode;
