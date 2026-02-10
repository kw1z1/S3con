class S3Dashboard {
    constructor() {
        this.baseUrl = window.location.origin;
        this.currentView = 'images';
        this.init();
    }

    init() {
        this.updateServerTime();
        setInterval(() => this.updateServerTime(), 1000);
        
        this.checkServerStatus();
        setInterval(() => this.checkServerStatus(), 10000);
        
        this.setupEventListeners();
        this.loadInitialData();
    }

    updateServerTime() {
        const now = new Date();
        document.getElementById('infoTime').textContent = 
            now.toLocaleTimeString('ru-RU');
    }

    async checkServerStatus() {
        const statusElement = document.getElementById('serverStatus');
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('span:last-child');
        
        indicator.className = 'status-indicator connecting';
        text.textContent = 'Проверка...';
        
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            const data = await response.json();
            
            if (data.status === 'OK') {
                indicator.className = 'status-indicator online';
                text.textContent = 'Сервер онлайн';
                
                // Обновляем информацию о режиме
                document.getElementById('infoMode').textContent = 
                    data.s3Connected ? 'production' : 'development';
                    
            } else {
                indicator.className = 'status-indicator offline';
                text.textContent = 'Сервер недоступен';
            }
        } catch (error) {
            indicator.className = 'status-indicator offline';
            text.textContent = 'Ошибка подключения';
        }
    }

    setupEventListeners() {
        // Навигация
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.switchView(view);
            });
        });

        // Поиск по группе
        document.getElementById('searchByGroup').addEventListener('click', () => {
            this.searchByGroup();
        });

        // Поиск по номеру вагона
        document.getElementById('searchByWagon').addEventListener('click', () => {
            this.searchByWagon();
        });

        // Последние изображения
        document.getElementById('getLatest').addEventListener('click', () => {
            this.getLatestImages();
        });

        // Список документов
        document.getElementById('listDocuments').addEventListener('click', () => {
            this.listDocuments();
        });

        // Статистика
        document.getElementById('refreshStats').addEventListener('click', () => {
            this.loadStats();
        });
    }

    switchView(viewName) {
        // Обновляем активную кнопку навигации
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Показываем соответствующую вкладку
        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active', view.id === `${viewName}View`);
        });

        this.currentView = viewName;
        
        // Загружаем данные для вкладки
        switch(viewName) {
            case 'images':
                this.loadGroupsInfo();
                break;
            case 'stats':
                this.loadStats();
                break;
            case 'uploader':
                this.loadUploaderInfo();
                break;
        }
    }

    async loadInitialData() {
        await this.loadGroupsInfo();
        await this.loadStats();
    }

    async loadGroupsInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/api/img/latest/5`);
            const data = await response.json();
            
            const infoContainer = document.getElementById('groupsInfo');
            if (infoContainer && data.images) {
                infoContainer.innerHTML = `
                    <div class="info-grid">
                        <div class="info-card">
                            <h4>Всего изображений</h4>
                            <p>${data.count}</p>
                        </div>
                        <div class="info-card">
                            <h4>Последнее обновление</h4>
                            <p>${new Date().toLocaleTimeString()}</p>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading groups info:', error);
        }
    }

    async searchByGroup() {
        const group = document.getElementById('groupSelect').value;
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;
        
        let url = `${this.baseUrl}/api/img/${group}`;
        if (fromDate) url += `?fromDate=${fromDate}`;
        if (toDate) url += `${fromDate ? '&' : '?'}toDate=${toDate}`;
        
        this.showLoading('imagesResults');
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            this.displayImageResults(data);
        } catch (error) {
            this.showError('Ошибка при поиске по группе');
        }
    }

    async searchByWagon() {
        const wagonNumber = document.getElementById('wagonNumber').value;
        const limit = document.getElementById('wagonLimit').value || 100;
        
        if (!wagonNumber) {
            this.showError('Введите номер вагона');
            return;
        }
        
        this.showLoading('imagesResults');
        
        try {
            const response = await fetch(`${this.baseUrl}/api/img/wagon/${wagonNumber}/${limit}`);
            const data = await response.json();
            this.displayImageResults(data);
        } catch (error) {
            this.showError('Ошибка при поиске по номеру вагона');
        }
    }

    async getLatestImages() {
        const limit = document.getElementById('latestLimit').value || 50;
        
        this.showLoading('imagesResults');
        
        try {
            const response = await fetch(`${this.baseUrl}/api/img/latest/${limit}`);
            const data = await response.json();
            this.displayImageResults(data);
        } catch (error) {
            this.showError('Ошибка при получении последних изображений');
        }
    }

    displayImageResults(data) {
        const container = document.getElementById('imagesResults');
        const countElement = document.getElementById('imagesCount');
        
        countElement.textContent = data.count || 0;
        
        if (!data.images || data.images.length === 0) {
            container.innerHTML = '<div class="notification info">Изображения не найдены</div>';
            return;
        }
        
        container.innerHTML = `
            <div class="images-grid">
                ${data.images.map(image => `
                    <div class="image-card">
                        <img src="${image.imageUrl}" alt="${image.filename}" class="image-preview" 
                             onerror="this.src='data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"250\" height=\"180\" viewBox=\"0 0 250 180\"><rect width=\"250\" height=\"180\" fill=\"%23111\"/><text x=\"125\" y=\"90\" text-anchor=\"middle\" fill=\"%23e6007a\" font-family=\"Space Mono\">IMAGE</text></svg>'">
                        <div class="image-info">
                            <h4>${image.filename}</h4>
                            <div class="image-meta">
                                <span>Группа: ${image.group}</span>
                                ${image.wagonNumber ? `<span>Вагон: ${image.wagonNumber}</span>` : ''}
                                <span>Время: ${new Date(image.timestamp).toLocaleString()}</span>
                            </div>
                            <div class="image-actions">
                                <button class="btn-secondary" onclick="window.open('${image.imageUrl}', '_blank')">
                                    <i class="fas fa-external-link-alt"></i> Открыть
                                </button>
                                <button class="btn-secondary" onclick="dashboard.downloadImage('${image.imageUrl}', '${image.filename}')">
                                    <i class="fas fa-download"></i> Скачать
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async listDocuments() {
        const prefix = document.getElementById('docPrefix').value;
        
        this.showLoading('documentsList');
        
        try {
            const url = prefix ? 
                `${this.baseUrl}/api/docs/list/${prefix}` : 
                `${this.baseUrl}/api/docs/list`;
                
            const response = await fetch(url);
            const data = await response.json();
            this.displayDocuments(data);
        } catch (error) {
            this.showError('Ошибка при получении списка документов');
        }
    }

    displayDocuments(data) {
        const container = document.getElementById('documentsList');
        
        if (!data.documents || data.documents.length === 0) {
            container.innerHTML = '<div class="notification info">Документы не найдены</div>';
            return;
        }
        
        container.innerHTML = `
            <div class="documents-list">
                ${data.documents.map(doc => `
                    <div class="document-item">
                        <div class="document-info">
                            <div class="document-name">${doc.filename}</div>
                            <div class="document-meta">
                                <span>Группа: ${doc.group}</span>
                                <span>Размер: ${this.formatFileSize(doc.size)}</span>
                                <span>Дата: ${new Date(doc.lastModified).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div class="document-actions">
                            <button class="btn-secondary" onclick="dashboard.viewDocument('${doc.filename}')">
                                <i class="fas fa-eye"></i> Просмотр
                            </button>
                            <button class="btn-primary" onclick="dashboard.downloadDocument('${doc.filename}')">
                                <i class="fas fa-download"></i> Скачать
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async loadStats() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            const data = await response.json();
            
            // Здесь можно добавить более детальную статистику
            document.getElementById('totalObjects').textContent = 'Загрузка...';
            document.getElementById('totalSize').textContent = 'Загрузка...';
            document.getElementById('uptime').textContent = new Date().toLocaleTimeString();
            
            // Показываем основную информацию
            document.getElementById('serverStatusInfo').textContent = 
                data.s3Connected ? 'Подключено к S3' : 'S3 недоступен';
                
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async loadUploaderInfo() {
        try {
            // Здесь можно добавить информацию о загрузчике
            document.getElementById('uploaderStatus').textContent = 'Активен';
            document.getElementById('monitoredPaths').textContent = '6 папок';
            document.getElementById('uploadQueue').textContent = '0 файлов';
        } catch (error) {
            console.error('Error loading uploader info:', error);
        }
    }

    downloadImage(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    viewDocument(filename) {
        window.open(`${this.baseUrl}/api/doc/${filename}`, '_blank');
    }

    downloadDocument(filename) {
        window.open(`${this.baseUrl}/api/doc/${filename}?download=true`, '_blank');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '<div class="loading"></div> Загрузка...';
        }
    }

    showError(message) {
        // Можно реализовать уведомления
        console.error(message);
        alert(message);
    }
}

// Инициализация при загрузке страницы
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new S3Dashboard();
});