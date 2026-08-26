document.addEventListener('DOMContentLoaded', function() {
    // Mobile navigation toggle
    const toggle = document.getElementById('navbarToggle');
    const menu = document.getElementById('navbarMenu');
    if (toggle && menu) {
        toggle.addEventListener('click', function() {
            menu.classList.toggle('active');
        });
    }
    
    // Dropdown toggle for mobile
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        if (toggle) {
            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                dropdown.classList.toggle('active');
            });
        }
    });
    
    // Alert close
    const alertClose = document.querySelectorAll('.alert-close');
    alertClose.forEach(btn => {
        btn.addEventListener('click', function() {
            this.parentElement.style.display = 'none';
        });
    });
    
    // Auto dismiss alerts
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.transition = 'opacity 0.5s';
            alert.style.opacity = '0';
            setTimeout(() => {
                alert.style.display = 'none';
            }, 500);
        }, 5000);
    });
    
    // Search tabs
    const tabs = document.querySelectorAll('.search-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const form = this.closest('form');
            if (form) {
                const typeInput = form.querySelector('input[name="type"]');
                if (typeInput) typeInput.value = this.dataset.type;
            }
        });
    });
});

// Lazy load images
document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    images.forEach(img => imageObserver.observe(img));
});

// Add to favorites
document.addEventListener('DOMContentLoaded', function() {
    const favoriteBtns = document.querySelectorAll('.action-btn .far.fa-heart');
    favoriteBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            this.classList.toggle('fas');
            this.classList.toggle('far');
            this.style.color = this.classList.contains('fas') ? '#B87333' : '';
        });
    });
});
