// libraries/functions.js
window.functions = {
    interestIncome: {
      description: "Calculates the interest income based on principal and annual rate",
      implementation: function(principal, rate) {
        console.log('interestIncome', principal, rate);
        return principal * rate;
      }
    }
    // Add additional functions as needed.
  };
