//TODO: https://gist.github.com/jbraithwaite/938d88e8f9bffdfce77e

module.exports = function (shipit) {
    require('shipit-deploy')(shipit);
    require('shipit-pm2')(shipit);

    const deployTo = '/home/ubuntu/wolfy-brain';
    const deployToCurrent = `${deployTo}/current`;

    shipit.initConfig({
        default: {
            workspace: '/Users/ricardocanastro/shipit-workspace/wolfy-brain',
            deployTo,
            repositoryUrl: 'https://github.com/canastro/wolfy-brain.git',
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
    shipit.on('published', function(){
        shipit.start('post-publish');
    });

    shipit.task('post-publish', ['npm-install']);

    // npm install
    // ----------------------------------------------------------------
    shipit.blTask('npm-install', function(){
        return shipit.remote(`cd ${deployToCurrent} && npm install`);
    });
};
