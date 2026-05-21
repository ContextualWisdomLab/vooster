export type DeviceFlowOptions = {
  apiUrl: string;
  authStub?: boolean;
  githubClientId?: string;
  writeLine?: (message: string) => void;
};

type DeviceCodeResponse = {
  device_code: string;
  expires_in: number;
  interval?: number;
  user_code: string;
  verification_uri: string;
};

type AccessTokenResponse = {
  access_token?: string;
  error?: string;
  interval?: number;
};

const grantType = "urn:ietf:params:oauth:grant-type:device_code";

export async function runDeviceFlow(options: DeviceFlowOptions): Promise<{ accessToken: string }> {
  void options.apiUrl;
  if (options.authStub === true) {
    return { accessToken: `stub-access-token-${process.env.VSPEC_AUTH_STUB_ID ?? "cli"}` };
  }

  const githubClientId = options.githubClientId ?? process.env.GITHUB_CLIENT_ID;
  if (githubClientId === undefined || githubClientId.trim() === "") {
    throw new Error("Missing GitHub client id.");
  }

  const device = await requestDeviceCode(githubClientId);
  options.writeLine?.(`Visit ${device.verification_uri} and enter code: ${device.user_code}`);

  return {
    accessToken: await pollForAccessToken(githubClientId, device)
  };
}

async function requestDeviceCode(githubClientId: string): Promise<DeviceCodeResponse> {
  const response = await fetch("https://github.com/login/device/code", {
    body: new URLSearchParams({
      client_id: githubClientId,
      scope: "read:user"
    }).toString(),
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });
  if (!response.ok) {
    throw new Error("GitHub device code request failed.");
  }

  return response.json() as Promise<DeviceCodeResponse>;
}

async function pollForAccessToken(
  githubClientId: string,
  device: DeviceCodeResponse
): Promise<string> {
  const expiresAt = Date.now() + device.expires_in * 1000;
  let intervalMs = (device.interval ?? 5) * 1000;

  while (Date.now() < expiresAt) {
    await sleep(intervalMs);
    const response = await requestAccessToken(githubClientId, device.device_code);
    if (response.access_token !== undefined) {
      return response.access_token;
    }
    if (response.error === "authorization_pending") {
      continue;
    }
    if (response.error === "slow_down") {
      intervalMs = ((response.interval ?? intervalMs / 1000) + 5) * 1000;
      continue;
    }
    if (response.error === "expired_token") {
      throw new Error("GitHub device code expired.");
    }

    throw new Error(`GitHub device flow failed: ${response.error ?? "unknown error"}.`);
  }

  throw new Error("GitHub device code expired.");
}

async function requestAccessToken(
  githubClientId: string,
  deviceCode: string
): Promise<AccessTokenResponse> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    body: new URLSearchParams({
      client_id: githubClientId,
      device_code: deviceCode,
      grant_type: grantType
    }).toString(),
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });
  if (!response.ok) {
    throw new Error("GitHub access token request failed.");
  }

  return response.json() as Promise<AccessTokenResponse>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
