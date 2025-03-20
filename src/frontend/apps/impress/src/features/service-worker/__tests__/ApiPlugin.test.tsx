/**
 * @jest-environment node
 */

import '@testing-library/jest-dom';

import { ApiPlugin } from '../ApiPlugin';
import { RequestSerializer } from '../RequestSerializer';

const mockedGet = jest.fn().mockResolvedValue({});
const mockedGetAllKeys = jest.fn().mockResolvedValue([]);
const mockedPut = jest.fn().mockResolvedValue({});
const mockedDelete = jest.fn().mockResolvedValue({});
const mockedClose = jest.fn().mockResolvedValue({});
const mockedOpendDB = jest.fn().mockResolvedValue({
  get: mockedGet,
  getAllKeys: mockedGetAllKeys,
  getAll: jest.fn().mockResolvedValue([]),
  put: mockedPut,
  delete: mockedDelete,
  clear: jest.fn().mockResolvedValue({}),
  close: mockedClose,
});

jest.mock('idb', () => ({
  ...jest.requireActual('idb'),
  openDB: () => mockedOpendDB(),
}));

describe('ApiPlugin', () => {
  afterEach(() => jest.clearAllMocks());

  [
    { type: 'item', table: 'doc-item' },
    { type: 'list', table: 'doc-list' },
    { type: 'update', table: 'doc-item' },
  ].forEach(({ type, table }) => {
    it(`calls fetchDidSucceed with type ${type} and status 200`, async () => {
      const mockedSync = jest.fn().mockResolvedValue({});
      const apiPlugin = new ApiPlugin({
        tableName: table as any,
        type: type as any,
        syncManager: {
          sync: () => mockedSync(),
        } as any,
      });

      const body = { lastName: 'Doe' };
      const bodyBuffer = RequestSerializer.objectToArrayBuffer(body);

      const requestInit = {
        request: {
          url: 'test-url',
          clone: () => mockedClone(),
          json: () => body,
        } as unknown as Request,
      } as any;
      const mockedClone = jest.fn().mockReturnValue(requestInit.request);
      await apiPlugin.requestWillFetch?.(requestInit);

      const response = await apiPlugin.fetchDidSucceed?.({
        request: {
          url: 'test-url',
          body,
        } as unknown as Request,
        response: new Response(bodyBuffer, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      } as any);

      expect(mockedPut).toHaveBeenCalledWith(table, body, 'test-url');
      expect(mockedClose).toHaveBeenCalled();
      expect(response?.status).toBe(200);
    });

    it(`calls fetchDidSucceed with type ${type} and status other that 200`, async () => {
      const apiPlugin = new ApiPlugin({
        tableName: table as any,
        type: type as any,
        syncManager: jest.fn() as any,
      });

      const body = { lastName: 'Doe' };
      const bodyBuffer = RequestSerializer.objectToArrayBuffer(body);

      const response = await apiPlugin.fetchDidSucceed?.({
        request: {
          url: 'test-url',
          body,
        } as unknown as Request,
        response: new Response(bodyBuffer, {
          status: 400,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      } as any);

      expect(mockedPut).not.toHaveBeenCalled();
      expect(response?.status).toBe(400);
    });
  });

  [
    { type: 'update', withClone: true },
    { type: 'delete', withClone: true },
    { type: 'create', withClone: true },
    { type: 'list', withClone: false },
    { type: 'item', withClone: false },
  ].forEach(({ type, withClone }) => {
    it(`calls requestWillFetch with type ${type}`, async () => {
      const mockedSync = jest.fn().mockResolvedValue({});

      const apiPlugin = new ApiPlugin({
        type: 'update',
        syncManager: {
          sync: () => mockedSync(),
        } as any,
      });

      const mockedClone = jest.fn().mockResolvedValue({});
      const requestInit = {
        request: {
          url: 'test-url',
          clone: () => mockedClone(),
        } as unknown as Request,
      } as any;
      const request = await apiPlugin.requestWillFetch?.(requestInit);

      if (withClone) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(mockedClone).toHaveBeenCalled();
      }

      expect(mockedSync).toHaveBeenCalled();
      expect(request?.url).toBe('test-url');
    });
  });

  it(`checks getApiCatchHandler`, async () => {
    const response = ApiPlugin.getApiCatchHandler();
    expect(await response.json()).toEqual({ error: 'Network is unavailable.' });
  });

  [
    { type: 'list', tableName: 'doc-list' },
    { type: 'item', tableName: 'doc-item' },
  ].forEach(({ type, tableName }) => {
    it(`checks handlerDidError with type ${type}`, async () => {
      const requestInit = {
        request: {
          url: 'test-url',
        } as unknown as Request,
      } as any;

      const apiPlugin = new ApiPlugin({
        type: type as 'list' | 'item' | 'update' | 'create' | 'delete',
        tableName: tableName as 'doc-list' | 'doc-item',
        syncManager: {} as any,
      });

      await apiPlugin.fetchDidFail?.({} as any);
      const response = await apiPlugin.handlerDidError?.(requestInit);
      expect(mockedGet).toHaveBeenCalledWith(tableName, 'test-url');
      expect(response?.status).toBe(200);
    });
  });

  it(`checks handlerDidError with type update`, async () => {
    const requestInit = {
      request: {
        url: 'http://test.jest/documents/123456/',
        clone: () => mockedClone(),
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
        arrayBuffer: () =>
          RequestSerializer.objectToArrayBuffer({
            test: 'test',
          }),
        json: () => ({
          test: 'test',
        }),
      } as unknown as Request,
    } as any;

    const mockedClone = jest.fn().mockReturnValue(requestInit.request);

    const mockedSync = jest.fn().mockResolvedValue({});
    const apiPlugin = new ApiPlugin({
      type: 'update',
      syncManager: {
        sync: () => mockedSync(),
      } as any,
    });

    mockedGetAllKeys.mockResolvedValue(['http://test.jest/documents/?page=1']);
    mockedGet.mockResolvedValue({
      results: [
        {
          id: '123456',
          title: 'test',
        },
      ],
    });

    await apiPlugin.requestWillFetch?.(requestInit);
    await apiPlugin.fetchDidFail?.({} as any);
    const response = await apiPlugin.handlerDidError?.(requestInit);
    expect(mockedGet).toHaveBeenCalledWith(
      'doc-item',
      'http://test.jest/documents/123456/',
    );
    expect(mockedGetAllKeys).toHaveBeenCalledWith('doc-list');

    expect(mockedPut).toHaveBeenCalledWith(
      'doc-mutation',
      expect.objectContaining({
        key: expect.any(String),
        requestData: expect.objectContaining({
          url: 'http://test.jest/documents/123456/',
          headers: {
            'content-type': 'application/json',
          },
        }),
      }),
      expect.any(String),
    );
    expect(mockedPut).toHaveBeenCalledWith(
      'doc-item',
      { results: [{ id: '123456', title: 'test' }], test: 'test' },
      'http://test.jest/documents/123456/',
    );
    expect(mockedPut).toHaveBeenCalledWith(
      'doc-list',
      { results: [{ id: '123456', test: 'test', title: 'test' }] },
      'http://test.jest/documents/?page=1',
    );

    expect(mockedPut).toHaveBeenCalledTimes(3);
    expect(mockedClose).toHaveBeenCalled();
    expect(response?.status).toBe(200);
  });

  it(`checks handlerDidError with type delete`, async () => {
    const requestInit = {
      request: {
        url: 'http://test.jest/documents/123456/',
        clone: () => mockedClone(),
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
        arrayBuffer: () =>
          RequestSerializer.objectToArrayBuffer({
            test: 'test',
          }),
        json: () => ({
          test: 'test',
        }),
      } as unknown as Request,
    } as any;

    const mockedClone = jest.fn().mockReturnValue(requestInit.request);

    const mockedSync = jest.fn().mockResolvedValue({});
    const apiPlugin = new ApiPlugin({
      type: 'delete',
      syncManager: {
        sync: () => mockedSync(),
      } as any,
    });

    mockedGetAllKeys.mockResolvedValue(['http://test.jest/documents/?page=1']);
    mockedGet.mockResolvedValue({
      results: [
        {
          id: '123456',
          title: 'test',
        },
        {
          id: 'another-id',
          title: 'test-2',
        },
      ],
    });

    await apiPlugin.requestWillFetch?.(requestInit);
    await apiPlugin.fetchDidFail?.({} as any);
    const response = await apiPlugin.handlerDidError?.(requestInit);
    expect(mockedDelete).toHaveBeenCalledWith(
      'doc-item',
      'http://test.jest/documents/123456/',
    );
    expect(mockedGetAllKeys).toHaveBeenCalledWith('doc-list');
    expect(mockedGet).toHaveBeenCalledWith(
      'doc-list',
      'http://test.jest/documents/?page=1',
    );

    expect(mockedPut).toHaveBeenCalledWith(
      'doc-mutation',
      expect.objectContaining({
        key: expect.any(String),
        requestData: expect.objectContaining({
          url: 'http://test.jest/documents/123456/',
        }),
      }),
      expect.any(String),
    );
    expect(mockedPut).toHaveBeenCalledWith(
      'doc-list',
      expect.objectContaining({
        results: expect.arrayContaining([
          {
            id: 'another-id',
            title: 'test-2',
          },
        ]),
      }),
      'http://test.jest/documents/?page=1',
    );

    expect(mockedPut).toHaveBeenCalledTimes(2);
    expect(mockedClose).toHaveBeenCalled();
    expect(response?.status).toBe(204);
  });

  it(`checks handlerDidError with type create`, async () => {
    Object.defineProperty(global, 'self', {
      value: {
        crypto: {
          randomUUID: jest.fn().mockReturnValue('444555'),
        },
      },
    });

    const requestInit = {
      request: {
        url: 'http://test.jest/documents/',
        clone: () => mockedClone(),
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
        arrayBuffer: () => RequestSerializer.objectToArrayBuffer({}),
        json: () => ({}),
      } as unknown as Request,
    } as any;

    const mockedClone = jest.fn().mockReturnValue(requestInit.request);

    const mockedSync = jest.fn().mockResolvedValue({});
    const apiPlugin = new ApiPlugin({
      type: 'create',
      syncManager: {
        sync: () => mockedSync(),
      } as any,
    });

    mockedGetAllKeys.mockResolvedValue(['http://test.jest/documents/?page=1']);
    mockedGet.mockResolvedValue({
      results: [
        {
          id: '123456',
          title: 'test',
        },
      ],
    });

    await apiPlugin.requestWillFetch?.(requestInit);
    await apiPlugin.fetchDidFail?.({} as any);
    const response = await apiPlugin.handlerDidError?.(requestInit);
    expect(mockedPut).toHaveBeenCalledWith(
      'doc-mutation',
      expect.objectContaining({
        key: expect.any(String),
        requestData: expect.any(Object),
      }),
      expect.any(String),
    );
    expect(mockedPut).toHaveBeenCalledWith(
      'doc-item',
      expect.objectContaining({}),
      'http://test.jest/documents/444555/',
    );
    expect(mockedPut).toHaveBeenCalledWith(
      'doc-list',
      expect.objectContaining({
        results: expect.arrayContaining([
          expect.objectContaining({
            id: '444555',
          }),
        ]),
      }),
      'http://test.jest/documents/?page=1',
    );
    expect(mockedGetAllKeys).toHaveBeenCalledWith('doc-list');
    expect(mockedGet).toHaveBeenCalledWith(
      'doc-list',
      'http://test.jest/documents/?page=1',
    );
    expect(mockedPut).toHaveBeenCalledTimes(3);
    expect(mockedClose).toHaveBeenCalled();
    expect(response?.status).toBe(201);
  });
});
