Module.register("MMM-BarberTracker", {
  defaults: {
    apiUrl: "http://YOUR_STRAPI_IP:1337/api/appointments",
    apiKey: "YOUR_API_KEY",
    refreshInterval: 300000 // 5 minutes
  },

  start: function() {
    this.appointments = [];
    this.earnings = 0;
    this.monthlyGoal = 3000; // Fetch from CMS later
    this.fetchData();
    setInterval(() => this.fetchData(), this.config.refreshInterval);
  },

  fetchData: function() {
    const today = new Date().toISOString().split('T')[0];
    fetch(`${this.config.apiUrl}?filters[Appointment_Date][$contains]=${today}`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` }
    })
      .then(res => res.json())
      .then(data => {
        this.appointments = data.data;
        this.earnings = data.data.reduce((sum, appt) => sum + appt.attributes.Price, 0);
        this.updateDom();
      });
  },

  getDom: function() {
    const wrapper = document.createElement("div");
    wrapper.className = "barber-tracker";

    // Today's Appointments
    const header = document.createElement("h2");
    header.innerHTML = "Today's Appointments";
    wrapper.appendChild(header);

    const list = document.createElement("ul");
    this.appointments.forEach(appt => {
      const li = document.createElement("li");
      li.innerHTML = `
        ${appt.attributes.Client_Name} - 
        ${appt.attributes.Service_Type} - 
        $${appt.attributes.Price}
      `;
      list.appendChild(li);
    });

    // Earnings & Budget Progress
    const earningsDiv = document.createElement("div");
    earningsDiv.innerHTML = `
      <h3>Today's Earnings: $${this.earnings}</h3>
      <div class="progress-bar">
        <div class="progress" style="width: ${(this.earnings / this.monthlyGoal) * 100}%"></div>
      </div>
      <p>Monthly Goal: $${this.monthlyGoal}</p>
    `;

    wrapper.appendChild(list);
    wrapper.appendChild(earningsDiv);
    return wrapper;
  }
});