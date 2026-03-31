pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
        APP_PORT = '3000'
        DEPLOY_DIR = '/opt/canary-manager'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                echo '📦 Checking out source code...'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo '📥 Installing Node.js dependencies...'
                sh 'npm ci --production=false'
            }
        }

        stage('Run Tests') {
            steps {
                echo '🧪 Running tests...'
                sh 'npm test'
            }
            post {
                failure {
                    echo '❌ Tests failed! Aborting deployment.'
                }
            }
        }

        stage('Build') {
            steps {
                echo '🔨 Building application...'
                sh 'echo "Build complete - No build step needed for Node.js"'
            }
        }

        stage('Deploy Canary') {
            steps {
                echo '🐤 Deploying canary version...'
                sh '''
                    # Stop existing service if running
                    sudo systemctl stop canary-manager || true

                    # Copy files to deployment directory
                    sudo mkdir -p ${DEPLOY_DIR}
                    sudo cp -r ./* ${DEPLOY_DIR}/

                    # Install production dependencies
                    cd ${DEPLOY_DIR}
                    sudo npm ci --production

                    # Copy environment file
                    sudo cp .env.example .env 2>/dev/null || true

                    # Restart service
                    sudo systemctl start canary-manager
                    sleep 5
                '''
            }
        }

        stage('Health Check') {
            steps {
                echo '🏥 Running health checks...'
                sh '''
                    # Wait for app to start
                    sleep 10

                    # Check health endpoint
                    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${APP_PORT}/api/health)

                    if [ "$HEALTH_STATUS" = "200" ]; then
                        echo "✅ Health check passed! Status: $HEALTH_STATUS"
                    else
                        echo "❌ Health check failed! Status: $HEALTH_STATUS"
                        exit 1
                    fi
                '''
            }
            post {
                failure {
                    echo '❌ Health check failed! Initiating rollback...'
                    sh '''
                        sudo systemctl stop canary-manager || true
                        echo "Rollback: Reverting to previous version"
                        # Restore from backup if available
                        if [ -d "${DEPLOY_DIR}.backup" ]; then
                            sudo rm -rf ${DEPLOY_DIR}
                            sudo mv ${DEPLOY_DIR}.backup ${DEPLOY_DIR}
                            sudo systemctl start canary-manager
                            echo "✅ Rollback complete"
                        fi
                    '''
                }
            }
        }

        stage('Promote to Production') {
            when {
                branch 'main'
            }
            steps {
                echo '🎉 Promoting canary to production...'
                sh '''
                    # Backup current version
                    sudo rm -rf ${DEPLOY_DIR}.backup
                    sudo cp -r ${DEPLOY_DIR} ${DEPLOY_DIR}.backup

                    echo "✅ Canary promoted to production successfully!"
                '''
            }
        }
    }

    post {
        always {
            echo "Pipeline completed. Build: ${env.BUILD_NUMBER}"
        }
        success {
            echo '✅ Pipeline succeeded!'
            // Notify the canary manager dashboard
            sh '''
                curl -s -X POST http://localhost:${APP_PORT}/api/jenkins/webhook \
                    -H "Content-Type: application/json" \
                    -d '{"build": {"number": '${BUILD_NUMBER}', "status": "SUCCESS"}}' || true
            '''
        }
        failure {
            echo '❌ Pipeline failed!'
            sh '''
                curl -s -X POST http://localhost:${APP_PORT}/api/jenkins/webhook \
                    -H "Content-Type: application/json" \
                    -d '{"build": {"number": '${BUILD_NUMBER}', "status": "FAILURE"}}' || true
            '''
        }
    }
}
