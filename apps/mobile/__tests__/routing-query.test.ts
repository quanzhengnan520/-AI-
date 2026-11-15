import * as queryString from 'query-string';

test('Router查询参数兼容中文、空格、证据位置和重复key', () => {
  const value = queryString.stringify({
    title: '预算 沟通',
    start: '0',
    end: '26',
    tag: ['项目甲', '项目乙'],
  });
  expect(queryString.parse(value)).toEqual({
    title: '预算 沟通',
    start: '0',
    end: '26',
    tag: ['项目甲', '项目乙'],
  });
  expect(queryString.parse('q=项目+预算')).toEqual({ q: '项目 预算' });
});
test('损坏百分号和无效UTF-8不会导致解析崩溃', () => {
  for (const value of ['q=%', 'q=%ZZ', 'q=%E0%A4%A', 'q=%C0%AF']) {
    expect(() => queryString.parse(value)).not.toThrow();
  }
});
test('异常百分号长串可解码，保留有效中文参数', () => {
  const result = queryString.parse(`title=%E9%A2%84%E7%AE%97&q=${'%C0'.repeat(5000)}`);
  expect(result.title).toBe('预算');
  expect(typeof result.q).toBe('string');
});
