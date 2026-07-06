export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ');
  let line = '';
  const lines: string[] = [];

  for (const word of words) {
    const test = `${line}${word} `;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line.trim());
      line = `${word} `;
    } else {
      line = test;
    }
  }

  lines.push(line.trim());
  const start = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((value, index) => ctx.fillText(value, x, start + index * lineHeight));
}
