import {
  NetworkConfigError,
  parsePublicNetworkConfig,
  parseRootNetworkConfig,
} from '../src/network-config';

const LOCAL_ENV = {
  FOCACCIA_LOCAL_HOST: '192.168.1.50',
  FOCACCIA_LOCAL_SUPABASE_URL: 'http://192.168.1.50:54331/',
  FOCACCIA_LOCAL_TICKETS_URL: 'http://192.168.1.50:3001/',
  FOCACCIA_LOCAL_WEB_URL: 'http://192.168.1.50:3000/',
  FOCACCIA_NETWORK_MODE: 'local',
};

const TUNNEL_ENV = {
  FOCACCIA_NETWORK_MODE: 'tunnel',
  FOCACCIA_TUNNEL_SUPABASE_URL: 'https://focaccia.share.zrok.io/',
  FOCACCIA_TUNNEL_TICKETS_URL: 'https://tickets.example.com/',
  FOCACCIA_TUNNEL_WEB_URL: 'https://dashboard.example.com/',
};

describe('parseRootNetworkConfig', () => {
  test('accepts local mode and normalizes trailing slashes', () => {
    expect(parseRootNetworkConfig(LOCAL_ENV)).toEqual({
      browserOrigins: [
        'http://192.168.1.50:3000',
        'http://192.168.1.50:3001',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ],
      diagnosticLabel: 'Local network',
      localHost: '192.168.1.50',
      mode: 'local',
      supabaseUrl: 'http://192.168.1.50:54331',
      ticketsUrl: 'http://192.168.1.50:3001',
      webUrl: 'http://192.168.1.50:3000',
    });
  });

  test('accepts HTTPS tunnel mode', () => {
    expect(parseRootNetworkConfig(TUNNEL_ENV)).toEqual({
      browserOrigins: ['https://dashboard.example.com', 'https://tickets.example.com'],
      diagnosticLabel: 'Tunnel',
      mode: 'tunnel',
      supabaseUrl: 'https://focaccia.share.zrok.io',
      ticketsUrl: 'https://tickets.example.com',
      webUrl: 'https://dashboard.example.com',
    });
  });

  test.each([undefined, '', 'production', 'LOCAL'])('rejects invalid or absent mode %p', (mode) => {
    expect(() => parseRootNetworkConfig({ ...LOCAL_ENV, FOCACCIA_NETWORK_MODE: mode })).toThrow(
      /FOCACCIA_NETWORK_MODE must be exactly local or tunnel/,
    );
  });

  test('rejects a missing selected URL', () => {
    expect(() =>
      parseRootNetworkConfig({ ...LOCAL_ENV, FOCACCIA_LOCAL_WEB_URL: undefined }),
    ).toThrow(/FOCACCIA_LOCAL_WEB_URL is required for local mode/);
  });

  test.each(['not-a-url', 'https://example.invalid', 'http://your-host:3000']) (
    'rejects malformed or placeholder local URL %s',
    (url) => {
      expect(() => parseRootNetworkConfig({ ...LOCAL_ENV, FOCACCIA_LOCAL_WEB_URL: url })).toThrow(
        NetworkConfigError,
      );
    },
  );

  test.each(['localhost', '127.0.0.1'])('rejects loopback host %s in physical local mode', (host) => {
    expect(() =>
      parseRootNetworkConfig({
        ...LOCAL_ENV,
        FOCACCIA_LOCAL_HOST: host,
        FOCACCIA_LOCAL_SUPABASE_URL: `http://${host}:54331`,
        FOCACCIA_LOCAL_TICKETS_URL: `http://${host}:3001`,
        FOCACCIA_LOCAL_WEB_URL: `http://${host}:3000`,
      }),
    ).toThrow(/stable private LAN IPv4/);
  });

  test('rejects non-HTTPS tunnel URLs', () => {
    expect(() =>
      parseRootNetworkConfig({
        ...TUNNEL_ENV,
        FOCACCIA_TUNNEL_SUPABASE_URL: 'http://focaccia.share.zrok.io',
      }),
    ).toThrow(/must use HTTPS in tunnel mode/);
  });

  test('rejects a local origin mixed into tunnel mode', () => {
    expect(() =>
      parseRootNetworkConfig({
        ...TUNNEL_ENV,
        FOCACCIA_TUNNEL_WEB_URL: 'https://192.168.1.50:3000',
      }),
    ).toThrow(/must not use a loopback or private-network host in tunnel mode/);
  });
});

describe('parsePublicNetworkConfig', () => {
  test('returns only selected public values and ignores server secrets', () => {
    const parsed = parsePublicNetworkConfig({
      EXPO_PUBLIC_FOCACCIA_LOCAL_HOST: '192.168.1.50',
      EXPO_PUBLIC_FOCACCIA_NETWORK_MODE: 'local',
      EXPO_PUBLIC_FOCACCIA_SUPABASE_URL: 'http://192.168.1.50:54331',
      EXPO_PUBLIC_FOCACCIA_TICKETS_URL: 'http://192.168.1.50:3001',
      EXPO_PUBLIC_FOCACCIA_WEB_URL: 'http://192.168.1.50:3000',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
      FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST: 'must-not-leak@example.com',
      SUPABASE_SERVICE_ROLE_KEY: 'must-not-leak',
    }, 'EXPO_PUBLIC_');

    expect(parsed).toEqual({
      anonKey: 'public-anon-key',
      browserOrigins: [
        'http://192.168.1.50:3000',
        'http://192.168.1.50:3001',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ],
      diagnosticLabel: 'Local network',
      localHost: '192.168.1.50',
      mode: 'local',
      supabaseUrl: 'http://192.168.1.50:54331',
      ticketsUrl: 'http://192.168.1.50:3001',
      webUrl: 'http://192.168.1.50:3000',
    });
    expect(JSON.stringify(parsed)).not.toMatch(/allowlist|service-role|must-not-leak/);
  });

  test('rejects direct Supabase API ports for physical-device local mode', () => {
    expect(() =>
      parseRootNetworkConfig({
        ...LOCAL_ENV,
        FOCACCIA_LOCAL_SUPABASE_URL: 'http://192.168.1.50:54321',
      }),
    ).toThrow(/constrained proxy port 54331/);
  });

  test('accepts loopback only when explicitly enabled for the cloud simulator', () => {
    expect(() => parsePublicNetworkConfig({
      EXPO_PUBLIC_FOCACCIA_LOCAL_HOST: '127.0.0.1',
      EXPO_PUBLIC_FOCACCIA_NETWORK_MODE: 'local',
      EXPO_PUBLIC_FOCACCIA_SUPABASE_URL: 'http://127.0.0.1:54331',
      EXPO_PUBLIC_FOCACCIA_TICKETS_URL: 'http://127.0.0.1:3001',
      EXPO_PUBLIC_FOCACCIA_WEB_URL: 'http://127.0.0.1:3000',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
    }, 'EXPO_PUBLIC_')).toThrow(/stable private LAN IPv4/);

    expect(parsePublicNetworkConfig({
      EXPO_PUBLIC_FOCACCIA_LOCAL_HOST: '127.0.0.1',
      EXPO_PUBLIC_FOCACCIA_NETWORK_MODE: 'local',
      EXPO_PUBLIC_FOCACCIA_SUPABASE_URL: 'http://127.0.0.1:54331',
      EXPO_PUBLIC_FOCACCIA_TICKETS_URL: 'http://127.0.0.1:3001',
      EXPO_PUBLIC_FOCACCIA_WEB_URL: 'http://127.0.0.1:3000',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
    }, 'EXPO_PUBLIC_', { allowCloudSimulatorLoopback: true })).toMatchObject({
      localHost: '127.0.0.1',
      mode: 'local',
      supabaseUrl: 'http://127.0.0.1:54331',
    });
  });
});
