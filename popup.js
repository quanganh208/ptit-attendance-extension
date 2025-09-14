document.addEventListener('DOMContentLoaded', function() {
  // Kiểm tra tab hiện tại
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const currentTabElement = document.getElementById('currentTab');
    const statusElement = document.getElementById('extensionStatus');

    if (currentTab.url && currentTab.url.includes('slink.ptit.edu.vn')) {
      currentTabElement.textContent = 'PTIT SLINK';
      currentTabElement.style.color = '#52c41a';
      statusElement.textContent = 'Đang hoạt động';
      statusElement.className = 'status-badge status-active';
    } else {
      currentTabElement.textContent = 'Không phải PTIT SLINK';
      currentTabElement.style.color = '#8c8c8c';
      statusElement.textContent = 'Không hoạt động';
      statusElement.className = 'status-badge status-inactive';
    }
  });

  // Nút mở PTIT SLINK
  document.getElementById('openSlink').addEventListener('click', function() {
    chrome.tabs.create({url: 'https://slink.ptit.edu.vn'});
  });

  // Nút làm mới trang
  document.getElementById('refreshPage').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.reload(tabs[0].id);
      window.close();
    });
  });

  // Click vào tên tác giả
  document.getElementById('author').addEventListener('click', function(e) {
    e.preventDefault();
    // Có thể thêm link GitHub hoặc website của bạn ở đây
  });
});