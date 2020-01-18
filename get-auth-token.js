/**
 * stand-alone script to create a user-specified token file that can be used to make calls to the Rose API
 *
 * @author Asuman Suenbuel
 *
 */

const { Auth } = require('./src/config')

const { OAuth2Client } = require('google-auth-library');
const http = require('http');
const url = require('url');
const opn = require('open');
const destroyer = require('server-destroy');
const { writeFileSync } = require('fs');

const port = 6001
const scopes = ['https://www.googleapis.com/auth/userinfo.profile',
		'https://www.googleapis.com/auth/userinfo.email']

/**
 * main function
 */
async function main(options) {
    const { oAuth2Client, tokens } = await getAuthenticatedClient();
    
    const url = 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json'
    const res = await oAuth2Client.request({url});
    const profile = res.data
    console.log(`profile found for "${profile.name}"`)
    //console.log(res.data);
    saveTokenFile(profile, tokens, options || {})
}

function _getDefaultTokensFilename(profile) {
    const profileString = `${profile.name.toLowerCase().split(/\s+/).join('-')}-${profile.id}`
    return `tokens-${profileString}.json`
}

function saveTokenFile(profile, tokens, options) {
    let filename;
    if (typeof options.filename === 'string') {
	filename = options.filename;
    } else {
	filename = _getDefaultTokensFilename(profile);
    }
    try {
	writeFileSync(filename, JSON.stringify(tokens, null, 2));
	if (typeof options.callback === 'function') {
	    options.callback(null, filename);
	} else {
	    console.log(`tokens written to "${filename}"; 'require' this file for your RoseAPI calls.`);
	}
    } catch (err) {
	if (typeof options.callback === 'function') {
	    options.callback(err);
	} else {
	    console.error(`something went wrong: ${err}`);
	}
    }
}

/**
 * Create a new OAuth2Client, and go through the OAuth2 content workflow.
 * Return the full client to the callback.
 */
async function getAuthenticatedClient() {
    const callbackUrl = `http://localhost:${port}${Auth.CallbackUrl}`;
    const oAuth2Client = new OAuth2Client(
	Auth.GoogleClientId,
	Auth.GoogleClientSecret,
	callbackUrl
    );
    oAuth2Client.on('tokens', (tokens) => {
	if (tokens.refresh_token) {
	    console.log(`refresh token: ${tokens.refresh_token}`);
	}
	console.log(`access token: ${tokens.access_token}`);
    });

    // Generate a code_verifier and code_challenge
    const codes = await oAuth2Client.generateCodeVerifierAsync();
    //console.log(codes);

    // Generate the url that will be used for the consent dialog.
    const authorizeUrl = oAuth2Client.generateAuthUrl({
	access_type: 'offline',
	scope: scopes,
	// When using `generateCodeVerifier`, make sure to use code_challenge_method 'S256'.
	code_challenge_method: 'S256',
	// Pass along the generated code challenge.
	code_challenge: codes.codeChallenge,
	prompt: 'select_account'
    });

    // Open an http server to accept the oauth callback. In this simple example,
    // the only request to our webserver is to /oauth2callback?code=<code>.
    return new Promise((resolve, reject) => {
	const server = http
	      .createServer(async (req, res) => {
		  try {
		      if (req.url.indexOf('callback') > -1) {
			  // acquire the code from the querystring, and close the web server.
			  const qs = new url.URL(req.url, `http://localhost:${port}`)
				.searchParams;
			  const code = qs.get('code');
			  //console.log(`Code is ${code}`);
			  res.end('<html><body>Authentication successful! Tokens file will be created, check your console.'
				  + '<p>You can safely close this tab.</p>'
				  + '</body></html>'
				 );
			  server.destroy();

			  // Now that we have the code, use that to acquire tokens.
			  // Pass along the generated code verifier that matches our code challenge.
			  const r = await oAuth2Client.getToken({
			      code,
			      codeVerifier: codes.codeVerifier,
			  });

			  // Make sure to set the credentials on the OAuth2 client.
			  //console.log(`tokens: ${JSON.stringify(r.tokens, null, 2)}`)
			  oAuth2Client.setCredentials(r.tokens);
			  console.info('Tokens acquired.');
			  resolve( { oAuth2Client, tokens: r.tokens });
		      }
		  } catch (e) {
		      reject(e);
		  }
	      })
	      .listen(port, () => {
		  // open the browser to the authorize url to start the workflow
		  opn(authorizeUrl, {wait: false}).then(cp => cp.unref());
	      });
	destroyer(server);
    });
}

module.exports = {
    getAuthToken: main
}

if (module === require.main) {
    const pargs = process.argv.splice(2);
    let args = []
    if (pargs.length === 1) {
	args.push(pargs[0])
    }
    main(...args).catch(console.error)
}
