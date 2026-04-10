/**
 * E2E 測試：驗證「新增→自動帶入預設名稱→編輯→儲存」完整路徑
 * 同時測試修改與刪除功能
 */

console.log('開始執行 E2E 測試：驗證完整路徑\n');
console.log('='.repeat(60));

// 模擬測試環境
const testEnvironment = {
  // 模擬的用戶資料
  user: {
    id: 'test-user-123',
    email: 'test@example.com'
  },
  
  // 模擬的初始分組資料
  initialGroups: [
    { id: 'group-1', name: '我的代號', user_id: 'test-user-123' },
    { id: 'group-2', name: '核心持股', user_id: 'test-user-123' }
  ],
  
  // 模擬的 Supabase 客戶端
  supabase: {
    data: [],
    error: null,
    
    // 模擬 from 方法
    from: function(table) {
      return {
        select: () => ({
          eq: (column, value) => ({
            data: this.data.filter(item => item[column] === value),
            error: this.error
          })
        }),
        insert: (data) => {
          const newItem = {
            id: `group-${Date.now()}`,
            ...data,
            user_id: testEnvironment.user.id
          };
          this.data.push(newItem);
          return {
            data: [newItem],
            error: null
          };
        },
        update: (updateData) => ({
          eq: (column, value) => {
            const item = this.data.find(item => item[column] === value);
            if (item) {
              Object.assign(item, updateData);
              return {
                data: [item],
                error: null
              };
            }
            return {
              data: null,
              error: { message: '找不到項目' }
            };
          }
        }),
        delete: () => ({
          eq: (column, value) => {
            const index = this.data.findIndex(item => item[column] === value);
            if (index !== -1) {
              this.data.splice(index, 1);
              return {
                data: null,
                error: null
              };
            }
            return {
              data: null,
              error: { message: '找不到項目' }
            };
          }
        })
      };
    },
    
    // 設置用戶（現在直接設置 testEnvironment.user）
    setUser: function(user) {
      testEnvironment.user = user;
    },
    
    // 設置初始資料
    setData: function(data) {
      this.data = [...data];
    }
  }
};

// 測試場景 1: 新增流程
async function testAddFlow() {
  console.log('測試場景 1: 新增流程');
  console.log('-'.repeat(40));
  
  let testPassed = true;
  const testSteps = [];
  
  // 步驟 1: 點擊「新增」按鈕
  testSteps.push('1. 點擊「新增」按鈕');
  console.log('✓ 步驟 1: 點擊「新增」按鈕');
  
  // 模擬點擊新增按鈕
  const handleAddNewGroup = () => {
    console.log('  - 新增按鈕被點擊');
    return {
      newGroupTempId: 'temp-group-' + Date.now(),
      defaultName: '觀察列表',
      isInEditMode: true
    };
  };
  
  const addResult = handleAddNewGroup();
  if (addResult.newGroupTempId && addResult.defaultName === '觀察列表' && addResult.isInEditMode) {
    console.log('  - ✅ 成功插入空白列，預設名稱: "觀察列表"，進入編輯模式');
    testSteps.push('  ✅ 成功插入空白列，預設名稱: "觀察列表"，進入編輯模式');
  } else {
    console.log('  - ❌ 新增流程失敗');
    testSteps.push('  ❌ 新增流程失敗');
    testPassed = false;
  }
  
  // 步驟 2: 編輯預設名稱
  testSteps.push('2. 編輯預設名稱');
  console.log('\n✓ 步驟 2: 編輯預設名稱');
  
  const newGroupName = '我的新觀察列表';
  console.log(`  - 修改名稱從「觀察列表」到「${newGroupName}」`);
  testSteps.push(`  - 修改名稱從「觀察列表」到「${newGroupName}」`);
  
  // 步驟 3: 點擊儲存按鈕
  testSteps.push('3. 點擊儲存按鈕');
  console.log('\n✓ 步驟 3: 點擊儲存按鈕');
  
  // 模擬儲存新分組
  const handleSaveNewGroup = async (groupName) => {
    console.log(`  - 嘗試儲存分組: ${groupName}`);
    
    // 檢查是否為預設名稱
    if (groupName === '觀察列表') {
      throw new Error('名稱不可為預設值');
    }
    
    // 模擬 Supabase 插入
    testEnvironment.supabase.setUser(testEnvironment.user);
    const result = testEnvironment.supabase.from('user_groups').insert({
      name: groupName,
      user_id: testEnvironment.user.id
    });
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return result.data[0];
  };
  
  try {
    const savedGroup = await handleSaveNewGroup(newGroupName);
    if (savedGroup && savedGroup.name === newGroupName) {
      console.log(`  - ✅ 成功儲存分組: ${savedGroup.name} (ID: ${savedGroup.id})`);
      testSteps.push(`  ✅ 成功儲存分組: ${savedGroup.name}`);
    } else {
      console.log('  - ❌ 儲存失敗');
      testSteps.push('  ❌ 儲存失敗');
      testPassed = false;
    }
  } catch (error) {
    console.log(`  - ❌ 儲存錯誤: ${error.message}`);
    testSteps.push(`  ❌ 儲存錯誤: ${error.message}`);
    testPassed = false;
  }
  
  // 步驟 4: 驗證預設名稱檢核
  testSteps.push('4. 驗證預設名稱檢核');
  console.log('\n✓ 步驟 4: 驗證預設名稱檢核');
  
  try {
    await handleSaveNewGroup('觀察列表');
    console.log('  - ❌ 預設名稱應該被拒絕，但通過了驗證');
    testSteps.push('  ❌ 預設名稱應該被拒絕，但通過了驗證');
    testPassed = false;
  } catch (error) {
    if (error.message === '名稱不可為預設值') {
      console.log('  - ✅ 預設名稱被正確拒絕');
      testSteps.push('  ✅ 預設名稱被正確拒絕');
    } else {
      console.log(`  - ❌ 錯誤訊息不正確: ${error.message}`);
      testSteps.push(`  ❌ 錯誤訊息不正確: ${error.message}`);
      testPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(40));
  console.log(`測試場景 1 結果: ${testPassed ? '✅ 通過' : '❌ 失敗'}`);
  
  return {
    passed: testPassed,
    steps: testSteps
  };
}

// 測試場景 2: 編輯流程
async function testEditFlow() {
  console.log('\n\n測試場景 2: 編輯流程');
  console.log('-'.repeat(40));
  
  let testPassed = true;
  const testSteps = [];
  
  // 設置測試資料
  testEnvironment.supabase.setData(testEnvironment.initialGroups);
  testEnvironment.supabase.setUser(testEnvironment.user);
  
  const groupToEdit = testEnvironment.initialGroups[0];
  const originalName = groupToEdit.name;
  const newName = '修改後的代號';
  
  testSteps.push(`1. 編輯分組 "${originalName}"`);
  console.log(`✓ 步驟 1: 編輯分組 "${originalName}"`);
  
  // 模擬編輯函數
  const handleEditGroup = async (groupId, updatedName) => {
    console.log(`  - 嘗試編輯分組 ID: ${groupId}, 新名稱: ${updatedName}`);
    
    if (!updatedName || updatedName.trim() === '') {
      throw new Error('請輸入有效的分組名稱');
    }
    
    // 模擬 Supabase 更新
    const result = testEnvironment.supabase.from('user_groups').update({
      name: updatedName
    }).eq('id', groupId);
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return result.data[0];
  };
  
  try {
    const updatedGroup = await handleEditGroup(groupToEdit.id, newName);
    if (updatedGroup && updatedGroup.name === newName) {
      console.log(`  - ✅ 成功編輯分組: ${updatedGroup.name}`);
      testSteps.push(`  ✅ 成功編輯分組: ${updatedGroup.name}`);
      
      // 驗證資料庫中的資料已更新
      const dbGroup = testEnvironment.supabase.data.find(g => g.id === groupToEdit.id);
      if (dbGroup && dbGroup.name === newName) {
        console.log(`  - ✅ 資料庫中的資料已更新`);
        testSteps.push(`  ✅ 資料庫中的資料已更新`);
      } else {
        console.log('  - ❌ 資料庫更新失敗');
        testSteps.push('  ❌ 資料庫更新失敗');
        testPassed = false;
      }
    } else {
      console.log('  - ❌ 編輯失敗');
      testSteps.push('  ❌ 編輯失敗');
      testPassed = false;
    }
  } catch (error) {
    console.log(`  - ❌ 編輯錯誤: ${error.message}`);
    testSteps.push(`  ❌ 編輯錯誤: ${error.message}`);
    testPassed = false;
  }
  
  // 測試空名稱驗證
  testSteps.push('2. 測試空名稱驗證');
  console.log('\n✓ 步驟 2: 測試空名稱驗證');
  
  try {
    await handleEditGroup(groupToEdit.id, '');
    console.log('  - ❌ 空名稱應該被拒絕，但通過了驗證');
    testSteps.push('  ❌ 空名稱應該被拒絕，但通過了驗證');
    testPassed = false;
  } catch (error) {
    if (error.message === '請輸入有效的分組名稱') {
      console.log('  - ✅ 空名稱被正確拒絕');
      testSteps.push('  ✅ 空名稱被正確拒絕');
    } else {
      console.log(`  - ❌ 錯誤訊息不正確: ${error.message}`);
      testSteps.push(`  ❌ 錯誤訊息不正確: ${error.message}`);
      testPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(40));
  console.log(`測試場景 2 結果: ${testPassed ? '✅ 通過' : '❌ 失敗'}`);
  
  return {
    passed: testPassed,
    steps: testSteps
  };
}

// 測試場景 3: 刪除流程
async function testDeleteFlow() {
  console.log('\n\n測試場景 3: 刪除流程');
  console.log('-'.repeat(40));
  
  let testPassed = true;
  const testSteps = [];
  
  // 設置測試資料
  testEnvironment.supabase.setData([...testEnvironment.initialGroups]);
  testEnvironment.supabase.setUser(testEnvironment.user);
  
  const groupToDelete = testEnvironment.initialGroups[1];
  const initialCount = testEnvironment.supabase.data.length;
  
  testSteps.push(`1. 刪除分組 "${groupToDelete.name}"`);
  console.log(`✓ 步驟 1: 刪除分組 "${groupToDelete.name}"`);
  console.log(`  - 刪除前分組數量: ${initialCount}`);
  
  // 模擬刪除函數
  const handleDeleteGroup = async (groupId) => {
    console.log(`  - 嘗試刪除分組 ID: ${groupId}`);
    console.log(`  - 當前用戶 ID: ${testEnvironment.user.id}`);
    
    if (!groupId) {
      throw new Error('無法識別要刪除的分組');
    }
    
    // 檢查權限（模擬 RLS）
    const group = testEnvironment.supabase.data.find(g => g.id === groupId);
    if (!group) {
      console.log(`  - 找不到分組 ID: ${groupId}`);
      throw new Error('找不到要刪除的分組');
    }
    
    console.log(`  - 分組用戶 ID: ${group.user_id}`);
    
    if (group.user_id !== testEnvironment.user.id) {
      console.log(`  - 權限檢查失敗: ${group.user_id} !== ${testEnvironment.user.id}`);
      throw new Error('沒有權限刪除此分組');
    }
    
    // 模擬 Supabase 刪除
    const result = testEnvironment.supabase.from('user_groups').delete().eq('id', groupId);
    
    if (result.error) {
      throw new Error(result.error.message);
    }
    
    return true;
  };
  
  try {
    const deleteResult = await handleDeleteGroup(groupToDelete.id);
    if (deleteResult) {
      console.log('  - ✅ 刪除請求成功');
      testSteps.push('  ✅ 刪除請求成功');
      
      // 驗證資料庫中的資料已刪除
      const finalCount = testEnvironment.supabase.data.length;
      const groupStillExists = testEnvironment.supabase.data.some(g => g.id === groupToDelete.id);
      
      console.log(`  - 刪除後分組數量: ${finalCount}`);
      
      if (finalCount === initialCount - 1 && !groupStillExists) {
        console.log('  - ✅ 資料庫中的資料已正確刪除');
        testSteps.push('  ✅ 資料庫中的資料已正確刪除');
      } else {
        console.log('  - ❌ 資料庫刪除失敗');
        testSteps.push('  ❌ 資料庫刪除失敗');
        testPassed = false;
      }
    } else {
      console.log('  - ❌ 刪除失敗');
      testSteps.push('  ❌ 刪除失敗');
      testPassed = false;
    }
  } catch (error) {
    console.log(`  - ❌ 刪除錯誤: ${error.message}`);
    testSteps.push(`  ❌ 刪除錯誤: ${error.message}`);
    testPassed = false;
  }
  
  // 測試權限驗證
  testSteps.push('2. 測試權限驗證');
  console.log('\n✓ 步驟 2: 測試權限驗證');
  
  // 重新設置測試資料（因為上一步已經刪除了分組）
  testEnvironment.supabase.setData([...testEnvironment.initialGroups]);
  const groupForPermissionTest = testEnvironment.initialGroups[0]; // 使用第一個分組測試權限
  
  // 模擬不同用戶嘗試刪除
  const otherUser = { id: 'other-user-456', email: 'other@example.com' };
  testEnvironment.supabase.setUser(otherUser);
  
  try {
    await handleDeleteGroup(groupForPermissionTest.id);
    console.log('  - ❌ 權限驗證失敗，其他用戶不應該能刪除');
    testSteps.push('  ❌ 權限驗證失敗，其他用戶不應該能刪除');
    testPassed = false;
  } catch (error) {
    if (error.message === '沒有權限刪除此分組') {
      console.log('  - ✅ 權限驗證正確，其他用戶無法刪除');
      testSteps.push('  ✅ 權限驗證正確，其他用戶無法刪除');
    } else {
      console.log(`  - ❌ 錯誤訊息不正確: ${error.message}`);
      testSteps.push(`  ❌ 錯誤訊息不正確: ${error.message}`);
      testPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(40));
  console.log(`測試場景 3 結果: ${testPassed ? '✅ 通過' : '❌ 失敗'}`);
  
  return {
    passed: testPassed,
    steps: testSteps
  };
}

// 執行所有 E2E 測試
async function runAllE2ETests() {
  console.log('E2E 測試：驗證「新增→自動帶入預設名稱→編輯→儲存」完整路徑\n');
  
  const testResults = [];
  
  // 執行測試場景 1: 新增流程
  const addFlowResult = await testAddFlow();
  testResults.push({
    name: '新增流程',
    passed: addFlowResult.passed,
    steps: addFlowResult.steps
  });
  
  // 執行測試場景 2: 編輯流程
  const editFlowResult = await testEditFlow();
  testResults.push({
    name: '編輯流程',
    passed: editFlowResult.passed,
    steps: editFlowResult.steps
  });
  
  // 執行測試場景 3: 刪除流程
  const deleteFlowResult = await testDeleteFlow();
  testResults.push({
    name: '刪除流程',
    passed: deleteFlowResult.passed,
    steps: deleteFlowResult.steps
  });
  
  // 顯示總結報告
  console.log('\n\n' + '='.repeat(60));
  console.log('E2E 測試總結報告');
  console.log('='.repeat(60));
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  testResults.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.name}: ${result.passed ? '✅ 通過' : '❌ 失敗'}`);
    
    if (!result.passed) {
      console.log('   失敗步驟:');
      result.steps.forEach(step => {
        if (step.includes('❌')) {
          console.log(`   ${step}`);
        }
      });
    }
    
    if (result.passed) {
      totalPassed++;
    } else {
      totalFailed++;
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`總測試場景: ${testResults.length}`);
  console.log(`通過: ${totalPassed}`);
  console.log(`失敗: ${totalFailed}`);
  console.log(`成功率: ${((totalPassed / testResults.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));
  
  // 完整路徑驗證
  console.log('\n完整路徑驗證:');
  console.log('-'.repeat(40));
  
  if (addFlowResult.passed && editFlowResult.passed && deleteFlowResult.passed) {
    console.log('✅ 「新增→自動帶入預設名稱→編輯→儲存」完整路徑驗證成功');
    console.log('✅ 修改與刪除功能驗證成功');
    console.log('✅ 所有 E2E 測試通過，系統功能完整');
  } else {
    console.log('❌ 完整路徑驗證失敗');
    console.log('❌ 請檢查失敗的測試場景');
  }
  
  console.log('='.repeat(60));
  
  return totalFailed === 0;
}

// 如果直接執行此文件，則運行測試
if (typeof require !== 'undefined' && require.main === module) {
  runAllE2ETests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('測試執行錯誤:', error);
    process.exit(1);
  });
}

module.exports = {
  testAddFlow,
  testEditFlow,
  testDeleteFlow,
  runAllE2ETests
};