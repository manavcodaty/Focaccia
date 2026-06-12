function quoteToml(value) {
  return JSON.stringify(value);
}

export function buildRuntimeSupabaseConfig(source, config) {
  const redirects = config.browserOrigins.map(quoteToml).join(', ');
  const siteUrl = quoteToml(config.ticketsUrl);
  let output = source.replace(/^site_url = .*$/m, `site_url = ${siteUrl}`);

  output = output.replace(
    /^additional_redirect_urls = .*$/m,
    `additional_redirect_urls = [${redirects}]`,
  );
  output = output.replace(/(\[studio\][\s\S]*?^enabled = )true$/m, '$1false');
  output = output.replace(/(\[inbucket\][\s\S]*?^enabled = )true$/m, '$1false');

  if (output === source) {
    throw new Error('Unable to locate Supabase Auth URL settings in config.toml.');
  }

  return output;
}
