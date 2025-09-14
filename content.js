(() => {
  "use strict";

  let currentEventDetail = null;

  // Hàm hiển thị thông báo kiểu Ant Design
  const showNotification = (type, message) => {
    // Kiểm tra xem có Ant Design message API không
    if (window.antd && window.antd.message) {
      window.antd.message[type](message);
      return;
    }

    // Fallback: Tạo notification tự custom theo style Ant Design
    const notification = document.createElement("div");

    // Style với user-select: none để tránh bôi đen
    const baseStyle = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      padding: 10px 16px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      line-height: 1.5715;
      animation: slideDown 0.3s ease-out;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      pointer-events: none;
    `;

    notification.style.cssText = baseStyle;

    // Màu sắc theo type
    let color = "";
    switch (type) {
      case "success":
        color = "#52c41a";
        break;
      case "error":
        color = "#ff4d4f";
        break;
      case "loading":
        color = "#1890ff";
        break;
      case "warning":
        color = "#faad14";
        break;
      default:
        color = "#1890ff";
    }

    notification.innerHTML = `<span style="color: ${color}; font-weight: 500; user-select: none;">${message}</span>`;
    document.body.appendChild(notification);

    // Animation
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `;
    if (!document.querySelector('style[data-notification-animation]')) {
      style.setAttribute('data-notification-animation', 'true');
      document.head.appendChild(style);
    }

    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = "slideDown 0.3s ease-out reverse";
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  };

  const parseEventDate = (ds) => {
    const [time, date] = ds.split(" ");
    const [h, m] = time.split(":");
    const [d, M, y] = date.split("/");
    return new Date(`${y}-${M}-${d}T${h}:${m}:00`);
  };

  const getAccessToken = () =>
    new Promise((res, rej) => {
      const data = sessionStorage.getItem(
        "oidc.user:https://gwdu.ptit.edu.vn/sso/realms/ptit:ptit-connect"
      );
      if (data) {
        try {
          const token = JSON.parse(data).access_token;
          token ? res(token) : rej("Access token not found");
        } catch (e) {
          rej(e);
        }
      } else rej("User data not found");
    });

  const getEventData = (token, prev, next) =>
    new Promise((res, rej) => {
      const url = `https://gwdu.ptit.edu.vn/qldt/thoi-khoa-bieu/sv/from/${prev.toISOString()}/to/${next.toISOString()}`;

      fetch(url, {
        method: "GET",
        headers: { Authorization: "Bearer " + token },
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          throw new Error(
            `Network response was not ok: ${response.statusText}`
          );
        })
        .then((data) => {
          const eventData = {};
          (data.data || []).forEach(
            (e) => (eventData[e.tenLopHocPhan] = e.nhomDiemDanh)
          );
          // Lưu vào chrome storage thay vì GM_setValue
          chrome.storage.local.set({ eventData: eventData });
          res(eventData);
        })
        .catch((error) => rej(error));
    });

  const encryptEventData = (evt) => {
    if (!evt || !evt.chuKy) return "";
    const value = Math.floor(
      Date.now() / 1000 / evt.chuKy + 47852777303
    ).toString();
    return CryptoJS.HmacSHA1(value, evt.khoaDiemDanh).toString(
      CryptoJS.enc.Hex
    );
  };

  const performAttendance = (token, otp, maNhomQr, button) => {
    fetch("https://gwdu.ptit.edu.vn/qldt/diem-danh/user/qr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "PTIT S-Link/5 CFNetwork/1568.200.51 Darwin/24.1.0",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "vi-VN,vi;q=0.9",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        otp: otp,
        maNhomQr: maNhomQr,
      }),
    })
      .then((response) => {
        if (response.ok) {
          showNotification("success", "Điểm danh thành công!");
        } else {
          response.json().then((data) => {
            let errorMsg = "Điểm danh thất bại!";
            if (data.message) errorMsg += ` (${data.message})`;
            showNotification("error", errorMsg);
          }).catch(() => {
            showNotification("error", "Điểm danh thất bại!");
          });
        }
        // Enable lại button
        if (button) {
          button.disabled = false;
          button.innerText = "Điểm Danh Ngay";
        }
      })
      .catch(() => {
        showNotification("error", "Lỗi kết nối!");
        // Enable lại button
        if (button) {
          button.disabled = false;
          button.innerText = "Điểm Danh Ngay";
        }
      });
  };

  // Thêm hàng trạng thái điểm danh vào modal
  const addAttendanceStatusRow = (hasAttendance) => {
    const tbody = document.querySelector(
      ".ant-modal-body .ant-descriptions table tbody"
    );
    if (!tbody) return;

    // Xóa row cũ nếu có
    const oldStatusRow = document.getElementById("attendanceStatusRow");
    if (oldStatusRow) oldStatusRow.remove();

    // Tạo row mới cho trạng thái điểm danh
    const statusRow = document.createElement("tr");
    statusRow.id = "attendanceStatusRow";
    statusRow.className = "ant-descriptions-row";

    const td = document.createElement("td");
    td.className = "ant-descriptions-item";
    td.setAttribute("colspan", "1");

    const container = document.createElement("div");
    container.className = "ant-descriptions-item-container";

    const label = document.createElement("span");
    label.className = "ant-descriptions-item-label";
    label.innerText = "Trạng thái điểm danh";

    const content = document.createElement("span");
    content.className = "ant-descriptions-item-content";

    const tag = document.createElement("span");
    tag.className = hasAttendance
      ? "ant-tag ant-tag-has-color css-eummze css-var-r0"
      : "ant-tag ant-tag-has-color css-eummze css-var-r0";
    tag.style.backgroundColor = hasAttendance ? "#ff4d4f" : "#faad14";
    tag.innerText = hasAttendance ? "Đã mở điểm danh" : "Chưa mở điểm danh";

    content.appendChild(tag);
    container.appendChild(label);
    container.appendChild(content);
    td.appendChild(container);
    statusRow.appendChild(td);

    // Chèn sau row "Loại sự kiện"
    const rows = tbody.querySelectorAll("tr.ant-descriptions-row");
    if (rows.length > 0) {
      rows[0].after(statusRow);
    } else {
      tbody.appendChild(statusRow);
    }
  };

  // Thêm hàng điểm danh trong modal
  const addAttendanceRowToModalTable = () => {
    const tbody = document.querySelector(
      ".ant-modal-body .ant-descriptions table tbody"
    );
    if (tbody) {
      let attendanceRow = document.getElementById("attendanceRowModal");
      if (!attendanceRow) {
        attendanceRow = document.createElement("tr");
        attendanceRow.id = "attendanceRowModal";
        attendanceRow.className = "ant-descriptions-row";

        const td = document.createElement("td");
        td.className = "ant-descriptions-item";
        td.setAttribute("colspan", "1");

        const itemContainer = document.createElement("div");
        itemContainer.className = "ant-descriptions-item-container";

        const label = document.createElement("span");
        label.className = "ant-descriptions-item-label";
        label.innerText = "Điểm danh";

        const content = document.createElement("span");
        content.className = "ant-descriptions-item-content";

        const button = document.createElement("button");
        button.className =
          "ant-btn css-eummze css-var-r0 ant-btn-primary ant-btn-color-primary ant-btn-variant-solid ant-btn-attendance";
        button.innerText = "Điểm Danh Ngay";

        button.onclick = () => {
          if (!currentEventDetail) {
            showNotification("warning", "Không có thông tin sự kiện!");
            return;
          }

          button.disabled = true;
          // Thêm loading spinner icon kiểu Ant Design
          button.innerHTML = `
            <span class="ant-btn-loading-icon">
              <span class="anticon anticon-loading">
                <svg viewBox="0 0 1024 1024" focusable="false" data-icon="loading" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                  <path d="M988 548c-19.9 0-36-16.1-36-36 0-59.4-11.6-117-34.6-171.3a440.45 440.45 0 00-94.3-139.9 437.71 437.71 0 00-139.9-94.3C629 83.6 571.4 72 512 72c-19.9 0-36-16.1-36-36s16.1-36 36-36c69.1 0 136.2 13.5 199.3 40.3C772.3 66 827 103 874 150c47 47 83.9 101.8 109.7 162.7 26.7 63.1 40.2 130.2 40.2 199.3.1 19.9-16 36-35.9 36z"></path>
                </svg>
              </span>
              Đang điểm danh...
            </span>
          `;

          // Chờ CryptoJS load xong
          const waitForCrypto = setInterval(() => {
            if (typeof CryptoJS !== "undefined") {
              clearInterval(waitForCrypto);

              getAccessToken()
                .then((token) => {
                  const otp = encryptEventData(currentEventDetail);
                  const maNhomQr = currentEventDetail.maNhomQr;
                  performAttendance(token, otp, maNhomQr, button);
                })
                .catch((err) => {
                  showNotification("error", "Lỗi lấy token: " + err);
                  button.disabled = false;
                  button.innerText = "Điểm Danh Ngay";
                });
            }
          }, 100);
        };

        content.appendChild(button);
        itemContainer.appendChild(label);
        itemContainer.appendChild(content);
        td.appendChild(itemContainer);
        attendanceRow.appendChild(td);
        tbody.appendChild(attendanceRow);
      }
    }
  };

  // Xử lý sự kiện khi người dùng click trên trang
  if (window.location.href.startsWith("https://slink.ptit.edu.vn")) {
    document.addEventListener("click", () => {
      setTimeout(() => {
        // Kiểm tra xem có modal mở không
        const modal = document.querySelector(".ant-modal-content");
        if (!modal) return;

        let eventName = "",
          startStr = "",
          endStr = "";
        document.querySelectorAll("tr.ant-descriptions-row").forEach((row) => {
          const label = row.querySelector("span.ant-descriptions-item-label");
          if (label) {
            const text = label.textContent.trim();
            if (text === "Lớp tín chỉ")
              eventName =
                row
                  .querySelector("span.ant-descriptions-item-content")
                  ?.textContent.trim() || "";
            if (text === "Thời gian bắt đầu")
              startStr =
                row
                  .querySelector("span.ant-descriptions-item-content")
                  ?.textContent.trim() || "";
            if (text === "Thời gian kết thúc")
              endStr =
                row
                  .querySelector("span.ant-descriptions-item-content")
                  ?.textContent.trim() || "";
          }
        });

        if (eventName) {
          const startTime = parseEventDate(startStr);
          const endTime = parseEventDate(endStr);
          getAccessToken()
            .then((token) => getEventData(token, startTime, endTime))
            .then((data) => {
              if (data[eventName] == null) {
                // Không có điểm danh
                addAttendanceStatusRow(false);
                currentEventDetail = null;
              } else {
                // Có điểm danh
                addAttendanceStatusRow(true);
                currentEventDetail = data[eventName];
                addAttendanceRowToModalTable();
              }
            })
            .catch(console.error);
        }
      }, 100);
    });
  }
})();