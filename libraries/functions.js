// libraries/functions.js
window.functions = {
    interestIncome: {
      description: "Calculates the interest income based on principal and annual rate",
      implementation: function(principal, rate) {
        console.log('interestIncome', principal, rate);
        return principal * rate;
      }
    },
    averageBalance: {
      description: "Calculates the average balance of a loan over its term",
      implementation: function(principal, payment, rate, maturity) {
          // Determine months until maturity using either maturity date or term
          const {monthsUntilMaturity, yearsUntilMaturity} = functions.untilMaturity.implementation(maturity);
          const monthlyRate = rate < 1 ? parseFloat(rate) / 12 : parseFloat(rate / 100) / 12;
          //console.log('payment, monthly rate, monthsUntilMaturity', payment, monthlyRate, monthsUntilMaturity)
          // Calculate the total principal over the loan period
          let cummulativePrincipal = 0;
          let tempPrincipal = principal;
          var month = 0;
          while (month < monthsUntilMaturity && tempPrincipal > 0) {
              cummulativePrincipal += tempPrincipal;
              tempPrincipal -= payment - tempPrincipal * monthlyRate;
              month++;
          }
          // Calculate average balance
          const averageBalance = cummulativePrincipal / monthsUntilMaturity;
          //console.log('principal, payment, rate, maturity, average', principal, payment, rate, maturity, averageBalance)
          return averageBalance.toFixed(2);
      }
    },
    untilMaturity: {
      description: "Calculates the number of months and years to maturity of a financial instrument",
      implementation: function(maturity = null) {
          let monthsUntilMaturity, yearsUntilMaturity;
  
          if (maturity) {
              const maturityDate = new Date(maturity);
              const currentDate = new Date();
  
              // Calculate the number of months from currentDate to maturityDate
              const yearsDifference = maturityDate.getFullYear() - currentDate.getFullYear();
              const monthsDifference = maturityDate.getMonth() - currentDate.getMonth();
  
              // Total months until maturity
              monthsUntilMaturity = yearsDifference * 12 + monthsDifference;
  
              // Adjust if days in the current month are fewer than the day of the maturity date
              if (currentDate.getDate() > maturityDate.getDate()) {
                  monthsUntilMaturity -= 1;
              }
  
              // Ensure monthsUntilMaturity is at least 1
              monthsUntilMaturity = Math.max(1, monthsUntilMaturity);
  
              // Calculate yearsUntilMaturity as the integer part of monthsUntilMaturity divided by 12
              yearsUntilMaturity = monthsUntilMaturity / 12;
  
              // Ensure yearsUntilMaturity is at least 1
              yearsUntilMaturity = Math.max(1, yearsUntilMaturity);
  
          } else {
              console.warn('Maturity date not provided, defaulting to 12 months and 1 year');
              monthsUntilMaturity = 12; // Default to 12 months if no maturity date is provided
              yearsUntilMaturity = 1;    // Default to 1 year
          }
  
          return { monthsUntilMaturity, yearsUntilMaturity };
      }
    },
  };
