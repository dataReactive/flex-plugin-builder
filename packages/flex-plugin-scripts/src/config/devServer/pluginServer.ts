import { logger } from 'flex-dev-utils';
import { Request, Response } from 'express-serve-static-core';
import { readFileSync } from 'flex-dev-utils/dist/fs';
import paths from 'flex-dev-utils/dist/paths';
import { Configuration } from 'webpack-dev-server';
import https from 'https';

export interface Plugin {
  src: string;
  name: string;
  enabled: boolean;
  remote?: boolean;
}

/**
 * Returns local plugins from  public/plugins.json
 * @private
 */
/* istanbul ignore next */
export const _getLocalPlugins = () => JSON.parse(readFileSync(paths().app.pluginsJsonPath)) as Plugin[];

/**
 * Generates the response headers
 *
 * @param port  the port the browser will be running on
 * @private
 */
export const _getHeaders = (port: number) => ({
  'Access-Control-Allow-Origin': `http://localhost:${port}`,
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Allow-Headers': 'Content-Type, X-Flex-Version, X-Flex-JWE',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
});

/**
 * Fetches the Plugins from Flex
 *
 * @param token     the JWE Token
 * @param version   the Flex version
 */
/* istanbul ignore next */
export const _getRemotePlugins = (token: string, version: string): Promise<Plugin[]> => {
  return new Promise((resolve, reject) => {
    const headers = {
      'X-Flex-JWE': token,
    };
    if (version) {
      headers['X-Flex-Version'] = version;
    }

    const options = {
      hostname: 'flex.twilio.com',
      port: 443,
      path: '/plugins',
      method: 'GET',
      headers,
    };

    https
      .request(options, (res) => {
        const data: Buffer[] = [];

        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => resolve(JSON.parse(Buffer.concat(data).toString())));
      })
      .on('error', reject)
      .end();
  });
};

/**
 * Rebase plugins with local plugins
 * @param remotePlugins   the plugins returned from Flex
 * @private
 */
export const _rebasePlugins = (remotePlugins: Plugin[]) => {
  return _getLocalPlugins()
    .map((plugin) => {
      // Local main (plugin) we are running
      if (plugin.name === paths().app.name) {
        return plugin;
      }

      // Plugin is disabled - do not load it
      if (!plugin.enabled) {
        return null;
      }

      // Load remote plugin from Flex
      if (plugin.remote === true) {
        return remotePlugins.find((p) => p.name === plugin.name);
      }

      // Backward compatibility / current way of running multiple local plugins
      if (plugin.src) {
        return plugin;
      }

      return null;
    })
    .filter(Boolean);
};

/**
 * Basic server to fetch plugins from Flex and return to the local dev-server
 * @param browserPort  the port of browser
 * @private
 */
export default (options: Configuration) => {
  const responseHeaders = _getHeaders(options.port || 3000);

  return async (req: Request, res: Response) => {
    const { headers, method } = req;

    if (method === 'OPTIONS') {
      res.writeHead(200, responseHeaders);
      return res.end();
    }
    if (method !== 'GET') {
      res.writeHead(404, responseHeaders);
      return res.end('Route not found');
    }
    logger.debug('GET /plugins')

    const jweToken = headers['x-flex-jwe'] as string;
    const flexVersion = headers['x-flex-version'] as string;
    if (!jweToken) {
      res.writeHead(400, responseHeaders);
      return res.end('No X-Flex-JWE was provided');
    }

    return _getRemotePlugins(jweToken, flexVersion)
      .then(remotePlugins => {
        logger.trace('Got remote plugins', remotePlugins);
        const plugins = _rebasePlugins(remotePlugins);

        res.writeHead(200, responseHeaders);
        res.end(JSON.stringify(plugins));
      })
      .catch(err => {
        res.writeHead(500, responseHeaders);
        res.end(err);
      });
  };
}
