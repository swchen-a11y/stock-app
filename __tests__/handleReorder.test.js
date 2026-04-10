/**
 * handleReorder 函數邏輯測試
 * 測試排序同步功能與錯誤處理邏輯
 */

// 測試資料
const testStocks = [
  {
    id: '1',
    user_id: 'user-123',
    symbol: '2330',
    market: 'TW',
    name: '台積電',
    group_name: ['我的代號'],
    category: '半導體'
  },
  {
    id: '2',
    user_id: 'user-123',
    symbol: '2317',
    market: 'TW',
    name: '鴻海',
    group_name: ['我的代號'],
    category: '電子製造'
  },
  {
    id: '3',
    user_id: 'user-123',
    symbol: 'AAPL',
    market: 'US',
    name: 'Apple Inc.',
    group_name: ['我的代號'],
    category: '科技'
  }
];

// 模擬 handleReorder 的更新邏輯
function simulateHandleReorderUpdates(newOrder) {
  return newOrder.map((stock, index) => {
    // 先處理預設值，再驗證必要欄位
    const processedStock = {
      ...stock,
      market: stock.market || 'TW',
      name: stock.name || '',
      group_name: stock.group_name || ['我的代號'],
      category: stock.category || ''
    };
    
    // 驗證必要欄位（使用處理後的資料）
    const requiredFields = ['id', 'symbol', 'market'];
    const missingFields = requiredFields.filter(field => !processedStock[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`股票資料不完整，缺少欄位: ${missingFields.join(', ')}`);
    }
    
    return {
      id: processedStock.id,
      sort_order: index,
      user_id: processedStock.user_id || '',
      symbol: processedStock.symbol,
      market: processedStock.market,
      name: processedStock.name,
      group_name: processedStock.group_name,
      category: processedStock.category,
      updated_at: new Date().toISOString()
    };
  });
}

// 模擬 useStockData 的資料驗證邏輯
function simulateUseStockDataValidation(data) {
  return (data || []).map(stock => ({
    ...stock,
    market: stock.market || 'TW',
    name: stock.name || '',
    group_name: stock.group_name || ['我的代號'],
    category: stock.category || ''
  }));
}

// 執行測試
function runTests() {
  console.log('=== 開始執行 handleReorder 邏輯測試 ===\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // 測試 1: 完整股票資料的排序
  try {
    totalTests++;
    console.log('測試 1: 完整股票資料的排序');
    const newOrder = [testStocks[2], testStocks[0], testStocks[1]];
    const updates = simulateHandleReorderUpdates(newOrder);
    
    if (updates.length !== 3) throw new Error('更新陣列長度不正確');
    if (updates[0].sort_order !== 0) throw new Error('第一個項目排序權重不正確');
    if (updates[0].market !== 'US') throw new Error('market 欄位不正確');
    if (updates[1].sort_order !== 1) throw new Error('第二個項目排序權重不正確');
    if (updates[2].sort_order !== 2) throw new Error('第三個項目排序權重不正確');
    
    console.log('✓ 測試通過：完整股票資料可以正確轉換為更新陣列\n');
    passedTests++;
  } catch (error) {
    console.log(`✗ 測試失敗：${error.message}\n`);
  }
  
  // 測試 2: 處理缺少 market 欄位的股票資料
  try {
    totalTests++;
    console.log('測試 2: 處理缺少 market 欄位的股票資料');
    const incompleteStock = {
      id: '4',
      user_id: 'user-123',
      symbol: 'TSM',
      // 缺少 market 欄位
      name: '台積電 ADR',
      group_name: ['我的代號'],
      category: '半導體'
    };
    
    const updates = simulateHandleReorderUpdates([incompleteStock]);
    
    if (updates[0].market !== 'TW') throw new Error('缺少 market 欄位時未使用預設值');
    if (updates[0].name !== '台積電 ADR') throw new Error('name 欄位不正確');
    
    console.log('✓ 測試通過：缺少 market 欄位的股票會使用預設值 "TW"\n');
    passedTests++;
  } catch (error) {
    console.log(`✗ 測試失敗：${error.message}\n`);
  }
  
  // 測試 3: 驗證必要欄位
  try {
    totalTests++;
    console.log('測試 3: 驗證必要欄位');
    const invalidStock = {
      id: '5',
      // 缺少 symbol 欄位
      market: 'TW',
      name: '測試股票'
    };
    
    // 應該拋出錯誤
    simulateHandleReorderUpdates([invalidStock]);
    console.log('✗ 測試失敗：應該拋出錯誤但沒有\n');
  } catch (error) {
    if (error.message.includes('缺少欄位: symbol')) {
      console.log('✓ 測試通過：必要欄位驗證可以正確識別缺少的 symbol 欄位\n');
      passedTests++;
    } else {
      console.log(`✗ 測試失敗：錯誤訊息不正確: ${error.message}\n`);
    }
  }
  
  // 測試 4: 處理空值或未定義的欄位
  try {
    totalTests++;
    console.log('測試 4: 處理空值或未定義的欄位');
    const stockWithNulls = {
      id: '6',
      user_id: null,
      symbol: 'TEST',
      market: null,
      name: null,
      group_name: null,
      category: null
    };
    
    const updates = simulateHandleReorderUpdates([stockWithNulls]);
    
    if (updates[0].market !== 'TW') throw new Error('null market 未使用預設值');
    if (updates[0].name !== '') throw new Error('null name 未轉換為空字串');
    if (!Array.isArray(updates[0].group_name)) throw new Error('null group_name 未轉換為陣列');
    if (updates[0].group_name[0] !== '我的代號') throw new Error('group_name 預設值不正確');
    
    console.log('✓ 測試通過：空值或未定義的欄位會使用適當的預設值\n');
    passedTests++;
  } catch (error) {
    console.log(`✗ 測試失敗：${error.message}\n`);
  }
  
  // 測試 5: useStockData 資料驗證
  try {
    totalTests++;
    console.log('測試 5: useStockData 資料驗證邏輯');
    const rawDataFromDB = [
      {
        id: '1',
        user_id: 'user-123',
        symbol: '2330',
        market: 'TW',
        name: '台積電',
        group_name: ['我的代號'],
        category: '半導體'
      },
      {
        id: '2',
        user_id: 'user-123',
        symbol: '2317',
        // 缺少 market 欄位
        name: '鴻海',
        group_name: null,
        category: ''
      }
    ];
    
    const validatedData = simulateUseStockDataValidation(rawDataFromDB);
    
    if (validatedData.length !== 2) throw new Error('驗證後資料長度不正確');
    if (validatedData[0].market !== 'TW') throw new Error('第一筆資料 market 不正確');
    if (validatedData[0].group_name[0] !== '我的代號') throw new Error('第一筆資料 group_name 不正確');
    if (validatedData[1].market !== 'TW') throw new Error('第二筆資料缺少 market 時未使用預設值');
    if (validatedData[1].group_name[0] !== '我的代號') throw new Error('第二筆資料 null group_name 未轉換為預設值');
    if (validatedData[1].category !== '') throw new Error('第二筆資料空 category 不正確');
    
    console.log('✓ 測試通過：useStockData 的資料驗證邏輯可以正確補全資料\n');
    passedTests++;
  } catch (error) {
    console.log(`✗ 測試失敗：${error.message}\n`);
  }
  
  // 測試 6: 處理空資料陣列
  try {
    totalTests++;
    console.log('測試 6: 處理空資料陣列');
    const emptyData = [];
    const validatedData = simulateUseStockDataValidation(emptyData);
    
    if (validatedData.length !== 0) throw new Error('空資料陣列驗證後長度不為 0');
    
    console.log('✓ 測試通過：空資料陣列可以正確處理\n');
    passedTests++;
  } catch (error) {
    console.log(`✗ 測試失敗：${error.message}\n`);
  }
  
  // 顯示測試結果
  console.log('=== 測試結果總結 ===');
  console.log(`總測試數: ${totalTests}`);
  console.log(`通過測試: ${passedTests}`);
  console.log(`失敗測試: ${totalTests - passedTests}`);
  console.log(`通過率: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 所有測試通過！');
    return true;
  } else {
    console.log('\n❌ 有測試失敗，請檢查錯誤訊息');
    return false;
  }
}

// 執行測試
const allTestsPassed = runTests();

// 匯出測試函數供其他測試使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    simulateHandleReorderUpdates,
    simulateUseStockDataValidation,
    runTests
  };
}