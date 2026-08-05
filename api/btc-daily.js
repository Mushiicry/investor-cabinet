import { handleBtcDailyApi } from "./_btcDaily.js";

export default function handler(req, res) {
  return handleBtcDailyApi(req, res);
}
