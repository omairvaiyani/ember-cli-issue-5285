module.exports = function (grunt) {
    var target, timestamp;
    timestamp = Date.now().toString();
    grunt.initConfig({
        gOptions: grunt.file.readJSON('grunt-options.json'),
        s3: {
            options: {
                key: '<%= gOptions.AWS.AccessKeyId %>',
                secret: '<%= gOptions.AWS.SecretKey %>',
                bucket: '<%= gOptions.AWS.bucket %>',
                access: 'public-read',
                headers: {
                    "Cache-Control": "max-age=630720000, public",
                    "Expires": new Date(Date.now() + 630720000).toUTCString()
                },
                maxOperations: 3
            },
            prod: {
                upload: [
                    {
                        src: 'dist/assets/*',
                        dest: '/assets/'
                    },
                    {
                        src: 'dist/img/favicon/*',
                        dest: '/img/favicon/'
                    },
                    {
                        src: 'dist/style/*',
                        dest: '/style/'
                    },
                    {
                        src: 'dist/js/*',
                        dest: '/js/'
                    },
                    {
                        src: 'dist/img/*',
                        dest: '/img/'
                    },
                    {
                        src: 'dist/img/features/*',
                        dest: '/img/features/'
                    }
                ]
            }
        },
        redis: {
            options: {
                prefix: timestamp + ':',
                currentDeployKey: timestamp + ":index.html",
                manifestKey: 'currentDeploySynap',
                host: '<%= gOptions.REDISTOGO.host %>',
                port: '<%= gOptions.REDISTOGO.port %>',
                connectionOptions: {
                    auth_pass: '<%= gOptions.REDISTOGO.password %>'
                },
                files: {
                    src: ["dist/index.html"]
                }
            },
            dev: {
                options: {
                    host: '<%= gOptions.REDISTOGO.host %>',
                    port: '<%= gOptions.REDISTOGO.port %>'
                },
                files: {
                    src: ["dist/index.html"]
                }
            },
            prod: {
                options: {
                    host: '<%= gOptions.REDISTOGO.host %>',
                    port: '<%= gOptions.REDISTOGO.port %>',
                    connectionOptions: {
                        auth_pass: '<%= gOptions.REDISTOGO.password %>'
                    }
                },
                files: {
                    src: ["dist/index.html"]
                }
            }
        },
        "shell": {
            options: {
                stdout: true,
                stderr: true,
                failOnError: true
            },
            dev: {
                command: 'ember build --environment=development'
            },
            prod: {
                command: 'ember build --environment=production'
            },
            parse: {
                command: [
                    'cd parse',
                    'cat source/* > cloud/main.js',
                    'parse deploy'
                ].join('&&')
            }
        }
    });
    grunt.loadNpmTasks('grunt-s3');
    grunt.loadNpmTasks('grunt-hashres');
    grunt.loadNpmTasks('grunt-redis');
    grunt.loadNpmTasks('grunt-cdn');
    grunt.loadNpmTasks('grunt-shell');
    target = grunt.option('prod') || grunt.option('p') ? 'prod' : 'dev';
    if(grunt.option('parse'))
        target = 'parse';
    if (target === 'prod') {
        return grunt.registerTask('default', ["shell:" + target, 's3', "redis:" + target]);
    } else if (target === 'parse') {
        return grunt.registerTask('default', ["shell:parse"]);
    } else {
        return grunt.registerTask('default', ["shell:" + target]);
    }
};
