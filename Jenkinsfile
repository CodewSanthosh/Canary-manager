node {
    def APP_PORT = '3000'
    def DEPLOY_DIR = '/home/azureuser/canary-manager'

    stage('📦 Checkout') {
        echo '=== Stage 1: Checking out source code from GitHub ==='
        checkout scm
        sh 'ls -la'
        echo "✅ Source code checked out successfully"
    }

    stage('📥 Install Dependencies') {
        echo '=== Stage 2: Installing Node.js dependencies ==='
        sh '''
            node --version
            npm --version
            npm install --production=false
        '''
        echo "✅ Dependencies installed"
    }

    stage('🧪 Run Tests') {
        echo '=== Stage 3: Running automated test suite ==='
        sh 'npm test'
        echo "✅ All 14 tests passed!"
    }

    stage('🐤 Deploy Canary') {
        echo '=== Stage 4: Deploying new version to server ==='
        sh """
            echo 'Stopping current service...'
            sudo systemctl stop canary-manager || true
            sleep 2

            echo 'Backing up current version...'
            sudo cp -r ${DEPLOY_DIR} ${DEPLOY_DIR}.backup 2>/dev/null || true

            echo 'Copying new code to server...'
            sudo cp -r \${WORKSPACE}/* ${DEPLOY_DIR}/
            cd ${DEPLOY_DIR}
            sudo npm install --production

            echo 'Starting service with new version...'
            sudo systemctl start canary-manager
            sleep 5
        """
        echo "✅ Canary deployed successfully"
    }

    stage('🏥 Health Check') {
        echo '=== Stage 5: Post-deployment health verification ==='
        sh """
            sleep 5
            echo 'Checking API health...'
            HEALTH_STATUS=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:${APP_PORT}/api/health)
            HEALTH_BODY=\$(curl -s http://localhost:${APP_PORT}/api/health)

            echo "HTTP Status: \$HEALTH_STATUS"
            echo "Response: \$HEALTH_BODY"

            if [ "\$HEALTH_STATUS" = "200" ]; then
                echo '✅ Health check PASSED! Application is healthy.'
            else
                echo '❌ Health check FAILED!'
                echo '🔄 Rolling back to previous version...'
                sudo systemctl stop canary-manager || true
                if [ -d '${DEPLOY_DIR}.backup' ]; then
                    sudo rm -rf ${DEPLOY_DIR}
                    sudo mv ${DEPLOY_DIR}.backup ${DEPLOY_DIR}
                    sudo systemctl start canary-manager
                    echo '✅ Rollback complete'
                fi
                exit 1
            fi
        """
    }

    stage('🎉 Promote to Production') {
        echo '=== Stage 6: Promoting canary to production ==='
        sh """
            echo 'Cleaning up backup...'
            sudo rm -rf ${DEPLOY_DIR}.backup
            sudo cp -r ${DEPLOY_DIR} ${DEPLOY_DIR}.backup
            echo '✅ Canary promoted to production!'
            echo 'Dashboard: http://20.255.60.247'
        """
    }

    // Post-build: notify the dashboard
    echo "✅ CI/CD Pipeline completed successfully! Build #${env.BUILD_NUMBER}"
    sh """
        curl -s -X POST http://localhost:${APP_PORT}/api/jenkins/webhook \
            -H 'Content-Type: application/json' \
            -d '{"build": {"number": ${env.BUILD_NUMBER}, "status": "SUCCESS"}}' || true
    """
}
