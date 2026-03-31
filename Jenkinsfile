pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
        APP_PORT = '3000'
        DEPLOY_DIR = '/home/azureuser/canary-manager'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                echo '📦 Stage 1: Checking out source code from GitHub...'
                checkout scm
                echo "Branch: ${env.GIT_BRANCH}"
                echo "Commit: ${env.GIT_COMMIT}"
                sh 'ls -la'
            }
        }

        stage('Install Dependencies') {
            steps {
                echo '📥 Stage 2: Installing Node.js dependencies...'
                sh '''
                    node --version
                    npm --version
                    npm ci --production=false
                    echo "✅ Dependencies installed successfully"
                    echo "Total packages:"
                    ls node_modules | wc -l
                '''
            }
        }

        stage('Run Tests') {
            steps {
                echo '🧪 Stage 3: Running test suite...'
                sh '''
                    npm test 2>&1
                    echo "✅ All tests passed!"
                '''
            }
            post {
                failure {
                    echo '❌ Tests failed! Aborting deployment — code quality gate not met.'
                }
            }
        }

        stage('Deploy to Server') {
            steps {
                echo '🐤 Stage 4: Deploying canary version to server...'
                sh '''
                    echo "Stopping existing service..."
                    sudo systemctl stop canary-manager || true
                    sleep 2

                    echo "Backing up current version..."
                    sudo cp -r ${DEPLOY_DIR} ${DEPLOY_DIR}.backup 2>/dev/null || true

                    echo "Deploying new code..."
                    sudo cp -r ./* ${DEPLOY_DIR}/
                    cd ${DEPLOY_DIR}
                    sudo npm ci --production

                    echo "Starting service..."
                    sudo systemctl start canary-manager
                    sleep 5
                    echo "✅ Deployment complete"
                '''
            }
        }

        stage('Health Check') {
            steps {
                echo '🏥 Stage 5: Running post-deployment health checks...'
                sh '''
                    sleep 5
                    echo "Checking API health endpoint..."
                    HEALTH_RESPONSE=$(curl -s http://localhost:${APP_PORT}/api/health)
                    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${APP_PORT}/api/health)

                    echo "Response: $HEALTH_RESPONSE"
                    echo "HTTP Status: $HEALTH_STATUS"

                    if [ "$HEALTH_STATUS" = "200" ]; then
                        echo "✅ Health check PASSED! Application is healthy."
                    else
                        echo "❌ Health check FAILED! Status: $HEALTH_STATUS"
                        echo "⚠️ Triggering automatic rollback..."
                        exit 1
                    fi
                '''
            }
            post {
                failure {
                    echo '🔄 Health check failed! Rolling back to previous version...'
                    sh '''
                        sudo systemctl stop canary-manager || true
                        if [ -d "${DEPLOY_DIR}.backup" ]; then
                            sudo rm -rf ${DEPLOY_DIR}
                            sudo mv ${DEPLOY_DIR}.backup ${DEPLOY_DIR}
                            sudo systemctl start canary-manager
                            echo "✅ Rollback complete — reverted to previous version"
                        else
                            echo "⚠️ No backup found — manual intervention required"
                        fi
                    '''
                }
            }
        }

        stage('Promote to Production') {
            steps {
                echo '🎉 Stage 6: Promoting canary to production...'
                sh '''
                    echo "Cleaning up backup..."
                    sudo rm -rf ${DEPLOY_DIR}.backup
                    sudo cp -r ${DEPLOY_DIR} ${DEPLOY_DIR}.backup

                    echo "✅ Canary successfully promoted to production!"
                    echo "Application URL: http://20.255.60.247"
                    echo "Jenkins URL: http://20.255.60.247:8080"
                '''
            }
        }
    }

    post {
        always {
            echo "Pipeline completed. Build #${env.BUILD_NUMBER}"
        }
        success {
            echo '✅ CI/CD Pipeline succeeded! Canary is live.'
            sh '''
                curl -s -X POST http://localhost:${APP_PORT}/api/jenkins/webhook \
                    -H "Content-Type: application/json" \
                    -d '{"build": {"number": '${BUILD_NUMBER}', "status": "SUCCESS"}}' || true
            '''
        }
        failure {
            echo '❌ CI/CD Pipeline failed! Check logs above.'
            sh '''
                curl -s -X POST http://localhost:${APP_PORT}/api/jenkins/webhook \
                    -H "Content-Type: application/json" \
                    -d '{"build": {"number": '${BUILD_NUMBER}', "status": "FAILURE"}}' || true
            '''
        }
    }
}
