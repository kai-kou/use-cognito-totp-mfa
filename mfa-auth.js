global.fetch = require('node-fetch')
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
const prompt = require('prompt');
const qrcode = require('qrcode-terminal');

const config = require('./config');


login = function () {
    prompt.start();
    let prompt_schema = {
      properties: {
        username: { required: true },
        password: { hidden: true }
      }
    };
    prompt.get(prompt_schema, function (err, result) {
        let username = result['username'];
        let password = result['password'];

        // ユーザープールID、アプリクライアントIDの設定
        let poolData = {
            UserPoolId: config.UserPoolId,
            ClientId: config.ClientId
        };

        // ユーザーの設定
        let userData = {
            Username: username,
            Pool: new AmazonCognitoIdentity.CognitoUserPool(poolData)
        };
        let cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

        // 認証情報の設定
        let authenticationData = {
            Username: username,
            Password: password
        };
        let authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);

        // Cognitoに認証を要求
        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: function (result) {
                // 認証成功時に発生します
                console.log('onSuccess');
                console.log('認証成功時に発生します');
                let idToken = result.getIdToken().getJwtToken();
                console.log('トークン取得できました^^');
                console.log(idToken);
            },
            newPasswordRequired: function (userAttributes, requiredAttributes) {
                // ユーザー作成後、初回ログイン時にパスワード変更が必要になる
                // とりあえず、仮パスワードをそのまま設定しています
                console.log('ユーザー作成後、初回ログイン時にパスワード変更が必要');
                cognitoUser.completeNewPasswordChallenge(password, {}, this);
            },
            mfaSetup: function (challengeName, challengeParameters) {
                // ユーザープールでMFAが有効化されていると発生します
                console.log('mfaSetup');
                console.log('ユーザープールでMFAが有効化されていると発生します');
                cognitoUser.associateSoftwareToken(this);
            },
            associateSecretCode: function (secretCode) {
                // MFA有効化されていてTOTP初回認証時に発生します
                // SecretCodeが発行されるので、Google Authenticatorなどに登録できるよう
                // QRコードを生成します。(シークレットコードを手動入力するのもあり)
                console.log('associateSecretCode');
                console.log('MFA有効化されていてTOTP初回認証時に発生します');

                // QRコードを生成してターミナルに表示
                let url = 'otpauth://totp/Test?secret=' + secretCode + '&issuer=Cognito-TOTP-MFA';
                console.log('シークレットコード: ' + secretCode);
                qrcode.generate(url, {small: true});

                let _this = this;
                let getValue = 'Google AuthenticatorでQRコードを読み取り、ワンタイムパスワードを入力してください';
                prompt.get([getValue], function (err, result) {
                    challengeAnswer = result[getValue];
                    cognitoUser.verifySoftwareToken(result[getValue], 'My TOTP device', _this);
                    console.log('2回目からはQRコードの読み取りは不要です');
                });
            },
            totpRequired: function (secretCode) {
                // ワンタイムパスワード要求時に発生
                // Google Authenticatorなどからワンタイムパスワードを入力して認証します
                console.log('totpRequired');
                console.log('ワンタイムパスワード要求時に発生');

                let _this = this
                let getValue = 'Google Authenticatorのワンタイムパスワードを入力してください';
                prompt.get([getValue], function (err, result) {
                    var challengeAnswer = result[getValue];
                    cognitoUser.sendMFACode(challengeAnswer, _this, 'SOFTWARE_TOKEN_MFA');
                });
            },
            onFailure: function (err) {
                console.log('onFailure');
                console.log('認証失敗時に発生します');
                console.log(err);
            }
        });
    });
};

login();
