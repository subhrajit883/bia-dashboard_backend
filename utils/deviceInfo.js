import { UAParser } from "ua-parser-js";

const getDeviceInfo = (req) => {
  const userAgent = req.headers["user-agent"] || "Unknown";
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    ipAddress: (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
      .toString().split(",")[0].trim(),
    deviceType: result.device.type || "desktop",
    browser: [result.browser.name, result.browser.version].filter(Boolean).join(" ") || "Unknown",
    operatingSystem: [result.os.name, result.os.version].filter(Boolean).join(" ") || "Unknown",
    userAgent
  };
};

export default getDeviceInfo;
