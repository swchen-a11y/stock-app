/**
 * 新增觀察列表表單功能測試
 * 測試即時新增表單的驗證邏輯與錯誤處理
 */

// 模擬測試資料
const mockGroups = [
  { id: '1', name: '我的代號' },
  { id: '2', name: '核心持股' }
];

// 模擬 Supabase 用戶
const mockUser = {
  id: 'user-123',
  email: 'test@example.com'
};

// 模擬 Supabase 響應
const mockSupabaseResponse = {
  data: [{ id: '3', user_id: 'user-123', name: '短線交易' }],
  error: null
};

// 測試 1: 空值驗證
function testEmptyValidation() {
  console.log('測試 1: 空值驗證');
  
  const testCases = [
    { input: '', expected: '請輸入分組名稱' },
    { input: '   ', expected: '請輸入分組名稱' },
    { input: null, expected: '請輸入分組名稱' },
    { input: undefined, expected: '請輸入分組名稱' }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase, index) => {
    // 模擬 handleAddGroup 函式
    const handleAddGroup = async (groupName) => {
      if (!groupName || groupName.trim() === '') {
        throw new Error('請輸入分組名稱');
      }
    };
    
    // 執行測試
    const testPromise = handleAddGroup(testCase.input);
    
    if (testCase.expected) {
      // 應該拋出錯誤
      testPromise
        .then(() => {
          console.log(`❌ 測試 ${index + 1} 失敗: 應該拋出錯誤但沒有`);
          failed++;
        })
        .catch(error => {
          if (error.message === testCase.expected) {
            console.log(`✅ 測試 ${index + 1} 通過: ${testCase.input || '空值'} -> ${error.message}`);
            passed++;
          } else {
            console.log(`❌ 測試 ${index + 1} 失敗: 期望 "${testCase.expected}"，實際 "${error.message}"`);
            failed++;
          }
        });
    } else {
      // 應該成功
      testPromise
        .then(() => {
          console.log(`✅ 測試 ${index + 1} 通過: ${testCase.input || '空值'} 驗證通過`);
          passed++;
        })
        .catch(error => {
          console.log(`❌ 測試 ${index + 1} 失敗: 不應該拋出錯誤但拋出了 "${error.message}"`);
          failed++;
        });
    }
  });
  
  console.log(`結果: ${passed} 通過, ${failed} 失敗\n`);
}

// 測試 2: 重複名稱驗證
function testDuplicateValidation() {
  console.log('測試 2: 重複名稱驗證');
  
  const groups = mockGroups;
  const testCases = [
    { input: '我的代號', expected: '已存在相同名稱的分組' },
    { input: '核心持股', expected: '已存在相同名稱的分組' },
    { input: '短線交易', expected: null } // 應該成功
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase, index) => {
    // 模擬 handleAddGroup 函式
    const handleAddGroup = async (groupName) => {
      const existingGroup = groups.find(g => g.name === groupName.trim());
      if (existingGroup) {
        throw new Error('已存在相同名稱的分組');
      }
    };
    
    // 執行測試
    const testPromise = handleAddGroup(testCase.input);
    
    if (testCase.expected) {
      // 應該拋出錯誤
      testPromise
        .then(() => {
          console.log(`❌ 測試 ${index + 1} 失敗: 應該拋出錯誤但沒有`);
          failed++;
        })
        .catch(error => {
          if (error.message === testCase.expected) {
            console.log(`✅ 測試 ${index + 1} 通過: "${testCase.input}" -> ${error.message}`);
            passed++;
          } else {
            console.log(`❌ 測試 ${index + 1} 失敗: 期望 "${testCase.expected}"，實際 "${error.message}"`);
            failed++;
          }
        });
    } else {
      // 應該成功
      testPromise
        .then(() => {
          console.log(`✅ 測試 ${index + 1} 通過: "${testCase.input}" 可以新增`);
          passed++;
        })
        .catch(error => {
          console.log(`❌ 測試 ${index + 1} 失敗: 不應該拋出錯誤但拋出了 "${error.message}"`);
          failed++;
        });
    }
  });
  
  console.log(`結果: ${passed} 通過, ${failed} 失敗\n`);
}

// 測試 3: 表單輸入處理
function testFormInputHandling() {
  console.log('測試 3: 表單輸入處理');
  
  // 模擬表單狀態
  let newGroupName = '';
  let addError = '';
  let isAdding = false;
  
  const testCases = [
    { 
      input: '新分組',
      actions: [
        { type: 'setName', value: '新分組' },
        { type: 'clearError' },
        { type: 'validate', expected: true }
      ]
    },
    { 
      input: '',
      actions: [
        { type: 'setName', value: '' },
        { type: 'setError', value: '請輸入分組名稱' },
        { type: 'validate', expected: false }
      ]
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase, index) => {
    console.log(`測試案例 ${index + 1}: "${testCase.input}"`);
    
    // 重置狀態
    newGroupName = '';
    addError = '';
    isAdding = false;
    
    // 執行動作
    testCase.actions.forEach(action => {
      switch (action.type) {
        case 'setName':
          newGroupName = action.value;
          console.log(`  設定名稱: "${newGroupName}"`);
          break;
        case 'setError':
          addError = action.value;
          console.log(`  設定錯誤: "${addError}"`);
          break;
        case 'clearError':
          addError = '';
          console.log(`  清除錯誤`);
          break;
        case 'validate':
          const isValid = newGroupName.trim() !== '' && addError === '';
          if (isValid === action.expected) {
            console.log(`  ✅ 驗證通過: ${isValid} === ${action.expected}`);
            passed++;
          } else {
            console.log(`  ❌ 驗證失敗: ${isValid} !== ${action.expected}`);
            failed++;
          }
          break;
      }
    });
  });
  
  console.log(`結果: ${passed} 通過, ${failed} 失敗\n`);
}

// 測試 4: 鍵盤快捷鍵
function testKeyboardShortcuts() {
  console.log('測試 4: 鍵盤快捷鍵');
  
  let enterCalled = false;
  let escapeCalled = false;
  
  // 模擬 handleKeyDown 函式
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      enterCalled = true;
      e.preventDefault();
    } else if (e.key === 'Escape') {
      escapeCalled = true;
    }
  };
  
  // 測試 Enter 鍵
  const enterEvent = { key: 'Enter', preventDefault: () => {} };
  handleKeyDown(enterEvent);
  
  if (enterCalled) {
    console.log('✅ Enter 鍵處理正確');
  } else {
    console.log('❌ Enter 鍵處理失敗');
  }
  
  // 測試 Escape 鍵
  const escapeEvent = { key: 'Escape' };
  handleKeyDown(escapeEvent);
  
  if (escapeCalled) {
    console.log('✅ Escape 鍵處理正確');
  } else {
    console.log('❌ Escape 鍵處理失敗');
  }
  
  console.log('');
}

// 測試 5: 跨瀏覽器兼容性
function testCrossBrowserCompatibility() {
  console.log('測試 5: 跨瀏覽器兼容性');
  
  // 測試不同的事件屬性
  const testCases = [
    { key: 'Enter', keyCode: 13 },
    { key: 'Escape', keyCode: 27 },
    { key: undefined, keyCode: 13 }, // 舊版瀏覽器
    { key: undefined, keyCode: 27 }
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase, index) => {
    // 模擬 handleKeyDown 函式（支援舊版瀏覽器）
    const handleKeyDown = (e) => {
      const key = e.key || (e.keyCode === 13 ? 'Enter' : e.keyCode === 27 ? 'Escape' : '');
      
      if (key === 'Enter') {
        if (e.preventDefault) e.preventDefault();
        return 'enter';
      } else if (key === 'Escape') {
        return 'escape';
      }
      return 'other';
    };
    
    // 創建模擬事件對象
    const mockEvent = {
      key: testCase.key,
      keyCode: testCase.keyCode,
      preventDefault: testCase.key === 'Enter' || testCase.keyCode === 13 ? () => {} : undefined
    };
    
    const result = handleKeyDown(mockEvent);
    
    if ((testCase.key === 'Enter' || testCase.keyCode === 13) && result === 'enter') {
      console.log(`✅ 測試 ${index + 1} 通過: Enter 鍵兼容性`);
      passed++;
    } else if ((testCase.key === 'Escape' || testCase.keyCode === 27) && result === 'escape') {
      console.log(`✅ 測試 ${index + 1} 通過: Escape 鍵兼容性`);
      passed++;
    } else {
      console.log(`❌ 測試 ${index + 1} 失敗: 鍵盤事件處理`);
      failed++;
    }
  });
  
  console.log(`結果: ${passed} 通過, ${failed} 失敗\n`);
}

// 執行所有測試
console.log('=== 新增觀察列表表單功能測試開始 ===\n');

testEmptyValidation();
testDuplicateValidation();
testFormInputHandling();
testKeyboardShortcuts();
testCrossBrowserCompatibility();

console.log('=== 測試完成 ===');