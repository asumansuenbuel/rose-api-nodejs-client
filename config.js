/**
 * Configuration parameters
 */

const config = {

    Server: {
	ApiUrl: 'https://rose-studio.cfapps.us10.hana.ondemand.com',
	LocalApiUrl: 'http://localhost:6001',
	ApiPath: '/api/v1'
    },
    
    Auth: {
	GoogleClientId: '662931900578-0ahfk02pj36mb1g7lb2u4lrgndn4fc1n.apps.googleusercontent.com',
	GoogleClientSecret: 'R2jxev6hbiSkgHbij8Uq3VUJ',
	CallbackUrl: '/api/auth/google/callback',
	GetUserInfoUrl: 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json'
    }
}

module.exports = config
