Module.register("MMM-BarberTracker", {
  defaults: {
    apiUrl: "https://whimsical-spirit-ecf25d2215.strapiapp.com/api/appointments",
    apiKey: "57e6df428c4b01c871cdf963540cac5b74087128fa2beb45f55799ab96a6add1e699f413cc35741ce487061abba86b5f127591bee1c37b52aa19f259de07eaf6b030cf8f9a91bcd382e694950ebba86d30e4fb90399349e1f78d8ffc1203f37918ed5849d561139faca8c263a01e3578c5e7ae37712e04ada5f70f4e0c491e87",
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
    //const today = new Date().toISOString().split('T')[0];    
	 const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
	  const startOfDay = `${today}T00:00:00Z`; // Start of the day in ISO format
	  const endOfDay = `${today}T23:59:59Z`; // End of the day in ISO format

  const url = `${this.config.apiUrl}`;
//  const url = `${this.config.apiUrl}?filters[Appointment_DateTime][$gte]=${startOfDay}&filters[Appointment_DateTime][$lte]=${endOfDay}`;



    fetch(url, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` }
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('Data retrieved:', data);
        if (data.data && data.data.length > 0) {
          this.appointments = data.data;
          this.earnings = data.data.reduce((sum, appt) => sum + appt.Price, 0);
          console.log('Appointments:', this.appointments);
          console.log('Earnings:', this.earnings);
        } else {
          console.log('No appointments found.');
        }
        this.updateDom();
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        // Consider adding a retry mechanism here
      });
  },

  getDom: function() {
    const wrapper = document.createElement("div");
    wrapper.className = "barber-tracker";

    // Formatter for US currency
	  const currencyFormatter = new Intl.NumberFormat("en-US", {
	    style: "currency",
	    currency: "USD"
	  });

    // Today's Appointments
    const header = document.createElement("h2");
    header.innerHTML = "Today's Appointments";
    wrapper.appendChild(header);

    const list = document.createElement("ul");
    if (this.appointments && this.appointments.length > 0) {
      this.appointments.forEach(appt => {
        const li = document.createElement("li");
        li.innerHTML = `
          ${appt.ClientName} - 
          ${appt.ServiceType} - 
          $${appt.Price}
        `;
        list.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.innerHTML = "No appointments today.";
      list.appendChild(li);
    }

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
