import JapanMap from "@/components/japan-map/JapanMap";
import { readFile } from "node:fs/promises";

// 都道府県の簡易統計（test.htmlの値を流用）。キーは接尾辞を除いた名称。
const prefectureStats: Record<string, { name: string; value: number }> = {
  北海道: { name: "北海道", value: 24981 },
  青森: { name: "青森県", value: 9876 },
  岩手: { name: "岩手県", value: 8543 },
  宮城: { name: "宮城県", value: 24156 },
  秋田: { name: "秋田県", value: 7432 },
  山形: { name: "山形県", value: 9654 },
  福島: { name: "福島県", value: 34213 },
  茨城: { name: "茨城県", value: 103315 },
  栃木: { name: "栃木県", value: 64766 },
  群馬: { name: "群馬県", value: 72369 },
  埼玉: { name: "埼玉県", value: 262382 },
  千葉: { name: "千葉県", value: 209137 },
  東京: { name: "東京都", value: 738946 },
  神奈川: { name: "神奈川県", value: 292450 },
  新潟: { name: "新潟県", value: 30874 },
  富山: { name: "富山県", value: 28739 },
  石川: { name: "石川県", value: 31019 },
  福井: { name: "福井県", value: 19462 },
  山梨: { name: "山梨県", value: 27894 },
  長野: { name: "長野県", value: 51937 },
  岐阜: { name: "岐阜県", value: 73997 },
  静岡: { name: "静岡県", value: 118848 },
  愛知: { name: "愛知県", value: 331733 },
  三重: { name: "三重県", value: 66946 },
  滋賀: { name: "滋賀県", value: 45748 },
  京都: { name: "京都府", value: 86975 },
  大阪: { name: "大阪府", value: 333564 },
  兵庫: { name: "兵庫県", value: 148190 },
  奈良: { name: "奈良県", value: 26344 },
  和歌山: { name: "和歌山県", value: 14523 },
  鳥取: { name: "鳥取県", value: 8765 },
  島根: { name: "島根県", value: 10987 },
  岡山: { name: "岡山県", value: 43737 },
  広島: { name: "広島県", value: 75021 },
  山口: { name: "山口県", value: 13876 },
  徳島: { name: "徳島県", value: 11234 },
  香川: { name: "香川県", value: 20338 },
  愛媛: { name: "愛媛県", value: 19827 },
  高知: { name: "高知県", value: 6543 },
  福岡: { name: "福岡県", value: 115859 },
  佐賀: { name: "佐賀県", value: 14321 },
  長崎: { name: "長崎県", value: 13456 },
  熊本: { name: "熊本県", value: 28456 },
  大分: { name: "大分県", value: 18456 },
  宮崎: { name: "宮崎県", value: 10456 },
  鹿児島: { name: "鹿児島県", value: 18987 },
  沖縄: { name: "沖縄県", value: 25223 },
};

async function getPrefectureGeoJSON() {
  // ネットワークを使わず、ローカルのデータのみ使用
  const path = "src/data/prefectures.geojson";
  try {
    const text = await readFile(path, "utf-8");
    return JSON.parse(text);
  } catch (e) {
    throw new Error(
      "prefectures.geojson が見つかりません。src/data/prefectures.geojson に配置してください。"
    );
  }
}

export default async function Home() {
  const geo = await getPrefectureGeoJSON();
  return (
    <div className="min-h-dvh">
      <JapanMap data={geo} stats={prefectureStats} />
    </div>
  );
}
