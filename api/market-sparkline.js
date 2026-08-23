import { handleMarketSparklineApi } from "./_marketSparkline.js";

export default function handler(req, res) {
  return handleMarketSparklineApi(req, res);
}
