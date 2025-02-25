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
  risk: {
    description: "Scores the risk of a checking account",
    implementation: function(balance, checks, deposits, nsf, source = null) {
      if (balance === 0 || source === null) return 0
      window.risk = window.risk || {};
      window.risk.balanceObject = window.risk.balanceObject || {};
      if (!window.risk.balanceObject[source]) {
        window.risk.balanceObject[source] = window.statistics[source][
          aiTranslator(Object.keys(window.statistics[source]), 'balance')
        ];
      }
      
      const balanceObject = window.risk.balanceObject[source];
      console.log('balanceObject', balanceObject)
      let balanceRisk = 1;
      if (balance > balanceObject.threeStdDeviations[1]) {
          balanceRisk = 5;
      } else if (balance > balanceObject.mean) {
          balanceRisk = 3;
      }

      // issuing checks for payroll, vendor payments, or refunds during specific times of the year may have a greater risk.
      window.risk.checksObject = window.risk.checksObject || {};
      if (!window.risk.checksObject[source]) {
        window.risk.checksObject[source] = window.statistics[source][
          aiTranslator(Object.keys(window.statistics[source]), 'checks')
        ];
      }
      const checksObject = window.risk.checksObject[source];
      let checksRisk = 1;
      if (checks > checksObject.threeStdDeviations[1]) {
          checksRisk = 5;
      } else if (checks > checksObject.twoStdDeviations[1]) {
          checksRisk = 4;
      } else if (checks > checksObject.mean) {
          checksRisk = 2;
      }

      // Regular deposits (e.g., payroll or vendor payments) indicate frequency of activity--higher active accounts may indicate risk.
      window.risk.depositsObject = window.risk.depositsObject || {};
      if (!window.risk.depositsObject[source]) {
        window.risk.depositsObject[source] = window.statistics[source][
          aiTranslator(Object.keys(window.statistics[source]), 'deposits')
        ];
      }
      const depositsObject = window.risk.depositsObject[source];
      let depositsRisk = 1;
      if (deposits > depositsObject.threeStdDeviations[1]) {
          depositsRisk = 5;
      } else if (deposits > depositsObject.twoStdDeviations[1]) {
          depositsRisk = 2;
      }

      // High overdraft activity could signal poor account management.
      window.risk.NSFsObject = window.risk.NSFsObject || {};
      if (!window.risk.NSFsObject[source]) {
        window.risk.NSFsObject[source] = window.statistics[source][
          aiTranslator(Object.keys(window.statistics[source]), 'nsf')
        ];
      }
      const NSFsObject = window.risk.NSFsObject[source];
      let NSFsRisk = 1;
      if (nsf > NSFsObject.threeStdDeviations[1]) {
          NSFsRisk = 5;
      }    

      return balanceRisk * dictionaries.depositRiskWeights["balance"] +
          checksRisk * dictionaries.depositRiskWeights["checks"] +
          depositsRisk * dictionaries.depositRiskWeights["deposits"] +
          NSFsRisk * dictionaries.depositRiskWeights["nsf"];
    }
  }
};

// supporting dictionaries
window.dictionaries = {
  depositRiskWeights: {
    description: "The weights for each deposit account risk criteria",
    "checks": 5,
    "balance": 5,
    "deposits": 3,
    "nsf": 1
  }
};