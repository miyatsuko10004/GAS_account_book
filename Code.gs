
    const SS_ID = 'YOUT_SS_ID';
    const LOCK = LockService.getScriptLock();

    // =================================================================
    // 診断用関数
    // =================================================================
    function runDiagnostics() {
      Logger.log("診断を開始します...");
      try {
        const sheets = getSheets();
        if(sheets) {
          Logger.log("✅ getSheets()は成功しました。");
          Logger.log("シート名: " + sheets.ss.getName());
          const data = getInitialData();
          if(data && data.dashboardData) {
            Logger.log("✅ getInitialData()は成功しました。");
            Logger.log("取得データ: " + JSON.stringify(data, null, 2));
          } else {
            Logger.log("❌ getInitialData()はデータを返しませんでした。");
          }
        } else {
          Logger.log("❌ getSheets()がnullを返しました。");
        }
      } catch(e) {
        Logger.log("❌ 診断中に致命的なエラーが発生しました: " + e.message + "\n" + e.stack);
      }
      Logger.log("診断を終了します。");
    }


    // =================================================================
    // Webアプリのエントリーポイント
    // =================================================================
    function doGet() {
      return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('バケット型家計簿')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
    }
    
    // =================================================================
    // シート取得ヘルパー
    // =================================================================
    function getSheets() {
      try {
        const ss = SpreadsheetApp.openById(SS_ID);
        if (!ss) throw new Error("スプレッドシートが見つかりません。Code.gsのSS_IDを確認してください。");
        
        const accountsSheet = ss.getSheetByName('Accounts');
        const transactionsSheet = ss.getSheetByName('Transactions');
        const templatesSheet = ss.getSheetByName('AllocationTemplates');
        const futureExpensesSheet = ss.getSheetByName('FutureExpenses');
        
        if (!accountsSheet) throw new Error("シート「Accounts」が見つかりません。");
        if (!transactionsSheet) throw new Error("シート「Transactions」が見つかりません。");
        if (!templatesSheet) throw new Error("シート「AllocationTemplates」が見つかりません。");
        if (!futureExpensesSheet) throw new Error("シート「FutureExpenses」が見つかりません。");
        
        return { ss, accountsSheet, transactionsSheet, templatesSheet, futureExpensesSheet };
      } catch (e) {
        Logger.log("getSheets Error: " + e.message);
        return null; // エラーが発生した場合はnullを返す
      }
    }


    // =================================================================
    // データ取得・更新のメイン関数
    // =================================================================
    function getInitialData() {
      LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        if (!sheets) {
          throw new Error("スプレッドシートまたは必要なシートの読み込みに失敗しました。");
        }
        return {
          dashboardData: getDashboardData(sheets),
          templates: getTemplates(sheets),
          futureExpenses: getFutureExpenses(sheets),
          transactions: getTransactions(sheets)
        };
      } catch(e) {
        Logger.log("getInitialData Error: " + e.message + "\n" + e.stack);
        // エラーが発生した場合でも、アプリがクラッシュしないように空の構造を返す
        return {
          dashboardData: { accounts: [], toBeBudgeted: 0 },
          templates: {},
          futureExpenses: [],
          transactions: []
        };
      } finally {
        LOCK.releaseLock();
      }
    }

    function recordTransaction(data) {
      LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        const id = 'T-' + new Date().toISOString().replace(/[-:.]/g, '');
        sheets.transactionsSheet.appendRow([id, data.date, data.type, data.amount, data.category, data.memo]);
        updateBalances(sheets);
        return getInitialData();
      } finally {
        LOCK.releaseLock();
      }
    }
    
    function recordSalary(salaryData) {
      LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        const id = 'T-' + new Date().toISOString().replace(/[-:.]/g, '');
        
        if (salaryData.category === '夫の給料') {
          const accounts = getAccounts(sheets);
          const defaultAccount = accounts.find(acc => acc.isDefault);
          const targetAccount = defaultAccount ? defaultAccount.category : '2人の貯金';
          
          // 収入と振分の両方を記録
          sheets.transactionsSheet.appendRow([id + '-I', salaryData.date, '収入', salaryData.amount, salaryData.category, salaryData.memo]);
          sheets.transactionsSheet.appendRow([id + '-A', salaryData.date, '振分', salaryData.amount, targetAccount, '夫の給料より自動振分']);
        } else {
          // 妻の給料は収入としてのみ記録
          sheets.transactionsSheet.appendRow([id, salaryData.date, '収入', salaryData.amount, salaryData.category, salaryData.memo]);
        }
        
        updateBalances(sheets);
        return getInitialData();
      } finally {
        LOCK.releaseLock();
      }
    }
    
    function updateTransaction(data) {
       LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        const allData = sheets.transactionsSheet.getDataRange().getValues();
        for (let i = 1; i < allData.length; i++) {
          if (allData[i][0] === data.id) {
            sheets.transactionsSheet.getRange(i + 1, 2, 1, 5).setValues([[data.date, data.type, data.amount, data.category, data.memo]]);
            break;
          }
        }
        updateBalances(sheets);
        return getInitialData();
      } finally {
        LOCK.releaseLock();
      }
    }

    function deleteTransaction(id) {
       LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        const allData = sheets.transactionsSheet.getDataRange().getValues();
        for (let i = 1; i < allData.length; i++) {
          if (allData[i][0] === id) {
            sheets.transactionsSheet.deleteRow(i + 1);
            break;
          }
        }
        updateBalances(sheets);
        return getInitialData();
      } finally {
        LOCK.releaseLock();
      }
    }

    function allocateFunds(allocations) {
      LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        const date = new Date();
        allocations.forEach(alloc => {
          const allocId = 'T-' + new Date().getTime() + '-A-' + alloc.category;
          sheets.transactionsSheet.appendRow([allocId, date, '振分', alloc.amount, alloc.category, '月次振分']);
          
          if (alloc.isExpense) {
            const expenseId = 'T-' + new Date().getTime() + '-E-' + alloc.category;
            sheets.transactionsSheet.appendRow([expenseId, date, '支出', alloc.amount, alloc.category, '月次消費']);
          }
        });
        updateBalances(sheets);
        return getInitialData();
      } finally {
        LOCK.releaseLock();
      }
    }
    
    function saveAllocationTemplate(templateName, templateData) {
      LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        const allData = sheets.templatesSheet.getDataRange().getValues();
        for (let i = allData.length - 1; i > 0; i--) {
          if (allData[i][0] === templateName) {
            sheets.templatesSheet.deleteRow(i + 1);
          }
        }
        templateData.incomes.forEach(item => {
          sheets.templatesSheet.appendRow([templateName, '収入', item.category, item.amount, '']);
        });
        templateData.allocations.forEach(item => {
          sheets.templatesSheet.appendRow([templateName, '振分', item.category, item.amount, item.isExpense]);
        });
        return getInitialData();
      } finally {
        LOCK.releaseLock();
      }
    }
    
    function saveAccount(accountData) {
      LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        const allAccounts = sheets.accountsSheet.getDataRange().getValues();
        let rowIndex = -1;
        for (let i = 1; i < allAccounts.length; i++) {
          // 既存のIDと一致するかチェック
          if (allAccounts[i][6] === accountData.id) {
            rowIndex = i + 1;
            break;
          }
        }
        
        const newRowData = [
          accountData.category,
          null, // Balance is calculated, not set directly
          accountData.type,
          accountData.group,
          accountData.goal || 0,
          accountData.isDefault
        ];

        if (rowIndex > -1) { // 更新
          sheets.accountsSheet.getRange(rowIndex, 1, 1, 6).setValues([newRowData]);
        } else { // 新規
          const newId = 'A-' + new Date().getTime();
          newRowData.push(newId);
          sheets.accountsSheet.appendRow(newRowData);
        }

        updateBalances(sheets);
        return getInitialData();
      } finally {
        LOCK.releaseLock();
      }
    }

    function deleteAccount(id) {
      LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        const allAccounts = sheets.accountsSheet.getDataRange().getValues();
        for (let i = 1; i < allAccounts.length; i++) {
          if (allAccounts[i][6] === id) {
            sheets.accountsSheet.deleteRow(i + 1);
            break;
          }
        }
        updateBalances(sheets);
        return getInitialData();
      } finally {
        LOCK.releaseLock();
      }
    }

    function saveFutureExpense(data) {
      LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        const allData = sheets.futureExpensesSheet.getDataRange().getValues();
        if (data.id) {
          for (let i = 1; i < allData.length; i++) {
            if (allData[i][0] === data.id) {
              sheets.futureExpensesSheet.getRange(i + 1, 2, 1, 4).setValues([[data.name, data.amount, data.date, data.sourceAccount]]);
              break;
            }
          }
        } else {
          const id = 'FE-' + new Date().toISOString().replace(/[-:.]/g, '');
          sheets.futureExpensesSheet.appendRow([id, data.name, data.amount, data.date, data.sourceAccount]);
        }
        return getInitialData();
      } finally {
        LOCK.releaseLock();
      }
    }

    function deleteFutureExpense(id) {
      LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        const allData = sheets.futureExpensesSheet.getDataRange().getValues();
        for (let i = 1; i < allData.length; i++) {
          if (allData[i][0] === id) {
            sheets.futureExpensesSheet.deleteRow(i + 1);
            break;
          }
        }
        return getInitialData();
      } finally {
        LOCK.releaseLock();
      }
    }

    // =================================================================
    // データ集計・計算
    // =================================================================
    function getDashboardData(sheets) {
      const accounts = getAccounts(sheets);
      const transactions = getTransactions(sheets);
      
      let toBeBudgeted = 0;
      transactions.forEach(t => {
        if (t.type === '収入') toBeBudgeted += t.amount;
        if (t.type === '振分') toBeBudgeted -= t.amount;
      });
      
      return { accounts, toBeBudgeted };
    }
    
    function updateBalances(sheets) {
      const accounts = getAccounts(sheets).reduce((map, acc) => {
        map[acc.category] = 0;
        return map;
      }, {});

      const transactions = getTransactions(sheets);
      transactions.forEach(t => {
        if (accounts.hasOwnProperty(t.category)) {
          if (t.type === '振分') accounts[t.category] += t.amount;
          if (t.type === '支出') accounts[t.category] -= t.amount;
        }
      });
      
      const accountData = getAccounts(sheets).map(acc => {
        return [acc.category, accounts[acc.category] || 0, acc.type, acc.group, acc.goal, acc.isDefault, acc.id];
      });
      
      if (accountData.length > 0) {
        sheets.accountsSheet.getRange(2, 1, accountData.length, 7).setValues(accountData);
      }
    }

    function getSimulationData(templateName, selectedAccounts) {
      LOCK.waitLock(15000);
      try {
        const sheets = getSheets();
        const templates = getTemplates(sheets);
        const template = templates[templateName];
        if (!template) throw new Error('Template not found');

        const futureExpenses = getFutureExpenses(sheets);
        const accounts = getAccounts(sheets);
        
        let simulatedBalances = accounts.reduce((acc, cv) => {
          acc[cv.category] = cv.balance;
          return acc;
        }, {});

        const monthlyTemplateIncome = Object.values(template.incomes || {}).reduce((sum, amount) => sum + amount, 0);
        const totalMonthlyAllocation = Object.values(template.allocations || {}).reduce((sum, data) => sum + data.amount, 0);
        const monthlyCouplesSavingsIncrease = monthlyTemplateIncome - totalMonthlyAllocation;

        const simulationResults = {};
        selectedAccounts.forEach(acc => {
          simulationResults[acc] = [];
        });
        
        for (let i = 0; i < 36; i++) {
          const futureDate = new Date();
          futureDate.setMonth(futureDate.getMonth() + i);
          const year = futureDate.getFullYear();
          const month = futureDate.getMonth();
          
          if (i > 0) {
            Object.entries(template.allocations || {}).forEach(([category, data]) => {
              if (simulatedBalances[category] !== undefined) {
                simulatedBalances[category] += data.amount;
              }
            });
            if (simulatedBalances["2人の貯金"] !== undefined) {
              simulatedBalances["2人の貯金"] += monthlyCouplesSavingsIncrease;
            }
          }

          futureExpenses.forEach(fe => {
            const feDate = new Date(fe.date);
            if (feDate.getFullYear() === year && feDate.getMonth() === month) {
              if (simulatedBalances[fe.sourceAccount] !== undefined) {
                simulatedBalances[fe.sourceAccount] -= fe.amount;
              }
            }
          });
          
          selectedAccounts.forEach(accName => {
            simulationResults[accName].push(simulatedBalances[accName] || 0);
          });
        }
        const labels = Array.from({length: 36}, (_, i) => {
          const d = new Date();
          d.setMonth(d.getMonth() + i);
          return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
        });

        return { labels, datasets: simulationResults };
      } finally {
        LOCK.releaseLock();
      }
    }

    // =================================================================
    // ヘルパー関数
    // =================================================================
    function getAccounts({ accountsSheet }) {
      const data = accountsSheet.getDataRange().getValues();
      if (data.length <= 1) return [];
      return data.slice(1).map((row, i) => ({ 
        id: row[6] || `A-${i+1}`, // Use stored ID or generate temporary one
        category: row[0], 
        balance: Number(row[1]) || 0,
        type: row[2],
        group: row[3],
        goal: Number(row[4]) || 0,
        isDefault: row[5] === true
      }));
    }
    function getTransactions({ transactionsSheet }) {
      const data = transactionsSheet.getDataRange().getValues();
      if (data.length <= 1) return [];
      return data.slice(1).map(row => ({ id: row[0], date: formatDate(new Date(row[1])), type: row[2], amount: Number(row[3]) || 0, category: row[4], memo: row[5] }));
    }
    function getTemplates({ templatesSheet }) {
      const data = templatesSheet.getDataRange().getValues();
      if (data.length <= 1) return {};
      return data.slice(1).reduce((map, row) => {
        const [templateName, type, category, amount, isExpense] = row;
        if (!map[templateName]) map[templateName] = { incomes: {}, allocations: {} };
        
        if (type === '収入') {
          map[templateName].incomes[category] = Number(amount) || 0;
        } else if (type === '振分') {
          map[templateName].allocations[category] = {
            amount: Number(amount) || 0,
            isExpense: isExpense === true
          };
        }
        return map;
      }, {});
    }
    function getFutureExpenses({ futureExpensesSheet }) {
      const data = futureExpensesSheet.getDataRange().getValues();
      if (data.length <= 1) return [];
      return data.slice(1).map(row => ({ id: row[0], name: row[1], amount: Number(row[2]) || 0, date: formatDate(new Date(row[3])), sourceAccount: row[4] }));
    }
    function formatDate(date) {
      return date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
    }
