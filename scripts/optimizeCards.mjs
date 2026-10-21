// 카드 원본 PNG(images/cards)를 화면용 WebP(public/images/cards)로 줄여 변환. 사용: npm run images
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE = "images/cards";
const OUTPUT = "public/images/cards";
// 결과 화면에서 가장 크게 보일 때(420px)의 레티나 2배
const WIDTH = 840;
const QUALITY = 82;

await mkdir(OUTPUT, { recursive: true });
const files = (await readdir(SOURCE)).filter((file) => /\.png$/i.test(file));

for (const file of files) {
  const output = path.join(OUTPUT, file.replace(/\.png$/i, ".webp"));
  const { size } = await sharp(path.join(SOURCE, file))
    .resize({ width: WIDTH })
    .webp({ quality: QUALITY })
    .toFile(output);
  console.log(`${file} → ${output} (${Math.round(size / 1024)}KB)`);
}
