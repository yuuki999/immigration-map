export type Position = [number, number];

export type MultiPolygon = Position[][][];

export type Feature = {
  type: "Feature";
  properties: { [k: string]: unknown } & {
    name?: string; // generic name
    pref?: string; // 都道府県名（データ源による）
    ken?: string; // 県名（代替）
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: Position[][] | MultiPolygon;
  };
};

export type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
};

