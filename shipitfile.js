const name = require('./package.json').name;
const deployTo = `/home/ubuntu/${name}`;
const deployToCurrent = `${deployTo}/current`;

module.exports = function (shipit) {
    require('shipit-deploy')(shipit);

    shipit.initConfig({
        default: {
            workspace: `/Users/ricardocanastro/shipit-workspace/${name}`,
            deployTo,
            repositoryUrl: `https://github.com/canastro/${name}.git`,
            ignores: ['.git', 'node_modules'],
            keepReleases: 5,
            deleteOnRollback: false,
            key: '/Users/ricardocanastro/aws/wolfy-key.pem',
            shallowClone: true
        },
        staging: {
            servers: 'ubuntu@ec2-52-31-60-109.eu-west-1.compute.amazonaws.com'
        }
    });

    // Listen to the on published event.
    shipit.on('published', () => {
        shipit.start('post-publish');
    });

    shipit.task('post-publish', ['clear-nodemodules', 'npm-install', 'pm2-start', 'pm2-save']);

    // npm install
    // ----------------------------------------------------------------
    shipit.blTask('clear-nodemodules', () =>
        shipit.remote(`cd ${deployToCurrent} && rm -rf node_modules`)
    );

    shipit.blTask('npm-install', () =>
        shipit.remote(`cd ${deployToCurrent} && npm install`)
    );

    // pm2 commands
    // ----------------------------------------------------------------
    shipit.blTask('pm2-start', () =>
        shipit.remote(`pm2 start ${deployToCurrent}/app.json`)
    );

    shipit.task('pm2-save', () =>
        shipit.remote('pm2 save')
    );
};
